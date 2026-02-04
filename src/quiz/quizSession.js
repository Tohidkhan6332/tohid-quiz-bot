const QuizService = require('./quizService');
const TohidCache = require('../lib/TohidCache');
const { Group, QuizSession } = require('../database/Tohidmodels');

class QuizSessionManager {
    constructor() {
        this.sessionStates = new Map();
    }
    
    async createSession(groupId, userId, userName, category, difficulty, numQuestions) {
        try {
            // Check if group exists and bot is enabled
            const group = await Group.findOne({ groupId });
            if (!group || !group.botEnabled) {
                return {
                    success: false,
                    error: 'Bot is not enabled in this group'
                };
            }
            
            // Check if group already has active quiz
            if (group.activeQuiz) {
                const activeSession = await QuizSession.findOne({
                    sessionId: group.activeQuiz,
                    isActive: true
                });
                
                if (activeSession) {
                    return {
                        success: false,
                        error: 'A quiz is already active in this group!'
                    };
                }
            }
            
            // Create quiz session
            const result = await QuizService.createGroupQuiz(
                groupId, userId, userName, category, difficulty, numQuestions
            );
            
            if (!result.success) {
                return result;
            }
            
            // Update group with active quiz
            group.activeQuiz = result.sessionId;
            group.lastActivity = new Date();
            group.stats.totalQuizzes += 1;
            await group.save();
            
            // Initialize session state
            this.sessionStates.set(result.sessionId, {
                groupId,
                startedBy: userId,
                category,
                difficulty,
                numQuestions,
                currentQuestion: 0,
                participants: new Map(),
                questionStartTime: null,
                timeout: null,
                stage: 'ready'
            });
            
            return {
                success: true,
                sessionId: result.sessionId,
                message: result.message
            };
            
        } catch (error) {
            console.error('Create Session Error:', error);
            return {
                success: false,
                error: 'Failed to create quiz session'
            };
        }
    }
    
    async startQuestion(sessionId, botClient) {
        const session = this.sessionStates.get(sessionId);
        if (!session) return null;
        
        const currentQuestion = await QuizService.getCurrentQuestion(sessionId);
        if (!currentQuestion) {
            return await this.endSession(sessionId, botClient);
        }
        
        session.currentQuestion++;
        session.questionStartTime = Date.now();
        session.stage = 'question_active';
        
        // Send question to group
        await botClient.sendQuizQuestion(
            session.groupId,
            currentQuestion,
            session.currentQuestion,
            session.numQuestions
        );
        
        // Set timeout for this question
        session.timeout = setTimeout(async () => {
            await this.handleQuestionTimeout(sessionId, botClient);
        }, 30000);
        
        return currentQuestion;
    }
    
    async handleAnswer(sessionId, userId, userName, answerIndex, botClient) {
        const session = this.sessionStates.get(sessionId);
        if (!session || session.stage !== 'question_active') {
            return null;
        }
        
        // Clear timeout
        if (session.timeout) {
            clearTimeout(session.timeout);
            session.timeout = null;
        }
        
        // Submit answer
        const result = await QuizService.submitAnswer(sessionId, userId, userName, answerIndex);
        
        if (!result.success) {
            await botClient.sendMessage(session.groupId, {
                text: '❌ Error processing your answer. Please try again.'
            });
            return null;
        }
        
        // Send result to group
        if (result.isCorrect) {
            await botClient.sendMessage(session.groupId, {
                text: `✅ *Correct!* ${userName} answered correctly!\n\n🎯 Points: +${result.points}\n📊 Total: ${result.participantScore}`
            });
        } else {
            await botClient.sendMessage(session.groupId, {
                text: `❌ *Incorrect!* The correct answer was: *${result.correctAnswer}*`
            });
        }
        
        // Move to next question after delay
        setTimeout(async () => {
            await this.startQuestion(sessionId, botClient);
        }, 2000);
        
        return result;
    }
    
    async handleQuestionTimeout(sessionId, botClient) {
        const session = this.sessionStates.get(sessionId);
        if (!session) return;
        
        const currentQuestion = await QuizService.getCurrentQuestion(sessionId);
        if (!currentQuestion) {
            return await this.endSession(sessionId, botClient);
        }
        
        await botClient.sendMessage(session.groupId, {
            text: `⏰ *Time's Up!*\n\nThe correct answer was: *${currentQuestion.correctAnswer}*`
        });
        
        // Move to next question after delay
        setTimeout(async () => {
            await this.startQuestion(sessionId, botClient);
        }, 2000);
    }
    
    async endSession(sessionId, botClient) {
        const session = this.sessionStates.get(sessionId);
        if (!session) return;
        
        // Clear timeout
        if (session.timeout) {
            clearTimeout(session.timeout);
        }
        
        // Get final results
        const results = await QuizService.endQuiz(sessionId);
        
        if (!results.success) {
            await botClient.sendMessage(session.groupId, {
                text: '❌ Error ending quiz session'
            });
            return;
        }
        
        // Send final results to group
        let resultText = `🏁 *Quiz Finished!*\n\n`;
        resultText += `📊 *Final Results:*\n\n`;
        
        results.leaderboard.forEach((participant, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            resultText += `${medal} *${participant.name}* - ${participant.score} points\n`;
        });
        
        if (results.leaderboard.length > 0) {
            const winner = results.leaderboard[0];
            resultText += `\n🎉 *Winner:* ${winner.name} with ${winner.score} points!\n`;
            resultText += `🏆 *Category:* ${session.category} | *Difficulty:* ${session.difficulty}`;
        }
        
        await botClient.sendMessage(session.groupId, { text: resultText });
        
        // Update group
        const group = await Group.findOne({ groupId: session.groupId });
        if (group) {
            group.activeQuiz = null;
            group.lastActivity = new Date();
            group.stats.lastQuizAt = new Date();
            group.stats.totalParticipants += session.participants.size;
            await group.save();
        }
        
        // Clear session state
        this.sessionStates.delete(sessionId);
        
        return results;
    }
    
    async getSessionStatus(sessionId) {
        const session = this.sessionStates.get(sessionId);
        if (!session) return null;
        
        return {
            sessionId,
            groupId: session.groupId,
            category: session.category,
            difficulty: session.difficulty,
            currentQuestion: session.currentQuestion,
            totalQuestions: session.numQuestions,
            participants: Array.from(session.participants.values()),
            stage: session.stage,
            timeRemaining: session.questionStartTime ? 
                30000 - (Date.now() - session.questionStartTime) : null
        };
    }
    
    async addParticipant(sessionId, userId, userName) {
        const session = this.sessionStates.get(sessionId);
        if (!session) return false;
        
        if (!session.participants.has(userId)) {
            session.participants.set(userId, {
                userId,
                name: userName,
                score: 0,
                answers: []
            });
            return true;
        }
        
        return false;
    }
    
    async getActiveSession(groupId) {
        for (const [sessionId, session] of this.sessionStates) {
            if (session.groupId === groupId) {
                return {
                    sessionId,
                    ...session
                };
            }
        }
        
        return null;
    }
    
    async stopSession(groupId, userId) {
        const session = await this.getActiveSession(groupId);
        if (!session) return null;
        
        if (session.startedBy !== userId && !TohidUtils.isAdmin(userId)) {
            return {
                success: false,
                error: 'Only quiz starter or admin can stop the quiz'
            };
        }
        
        return await QuizService.stopQuiz(groupId, userId);
    }
}

module.exports = new QuizSessionManager();