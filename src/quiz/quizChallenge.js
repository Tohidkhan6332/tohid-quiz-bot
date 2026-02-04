const QuizService = require('./quizService');
const TohidCache = require('../lib/TohidCache');
const TohidUtils = require('../lib/TohidUtils');
const { Challenge, User } = require('../database/Tohidmodels');

class ChallengeManager {
    constructor() {
        this.activeChallenges = new Map();
        this.challengeStates = new Map();
    }
    
    async createChallenge(challengerId, challengerName, opponentId, opponentName, category, difficulty) {
        try {
            // Check if opponent exists
            const opponent = await User.findOne({ userId: opponentId });
            if (!opponent) {
                return {
                    success: false,
                    error: 'Opponent not found'
                };
            }
            
            // Check if opponent is blocked
            if (opponent.isBlocked) {
                return {
                    success: false,
                    error: 'Cannot challenge blocked user'
                };
            }
            
            // Check for existing pending challenge
            const existingChallenge = await Challenge.findOne({
                $or: [
                    { challengerId, opponentId, status: 'pending' },
                    { challengerId: opponentId, opponentId: challengerId, status: 'pending' }
                ]
            });
            
            if (existingChallenge) {
                return {
                    success: false,
                    error: 'There is already a pending challenge between you'
                };
            }
            
            // Create challenge
            const result = await QuizService.createChallenge(
                challengerId, challengerName, opponentId, opponentName, category, difficulty
            );
            
            if (!result.success) {
                return result;
            }
            
            // Initialize challenge state
            this.challengeStates.set(result.challengeId, {
                challengeId: result.challengeId,
                challengerId,
                challengerName,
                opponentId,
                opponentName,
                category,
                difficulty,
                currentQuestion: 0,
                challengerAnswers: [],
                opponentAnswers: [],
                isChallengerTurn: true,
                stage: 'pending'
            });
            
            // Set expiration timer
            setTimeout(async () => {
                await this.handleChallengeExpiration(result.challengeId);
            }, 120000); // 2 minutes
            
            return {
                success: true,
                challengeId: result.challengeId,
                message: result.message
            };
            
        } catch (error) {
            console.error('Create Challenge Error:', error);
            return {
                success: false,
                error: 'Failed to create challenge'
            };
        }
    }
    
    async acceptChallenge(challengeId, userId) {
        try {
            const challengeState = this.challengeStates.get(challengeId);
            if (!challengeState) {
                throw new Error('Challenge not found');
            }
            
            if (challengeState.opponentId !== userId) {
                throw new Error('Only the challenged user can accept');
            }
            
            if (challengeState.stage !== 'pending') {
                throw new Error('Challenge is no longer pending');
            }
            
            // Update database
            const challenge = await Challenge.findOne({ challengeId });
            if (!challenge) {
                throw new Error('Challenge not found in database');
            }
            
            challenge.status = 'accepted';
            challenge.startedAt = new Date();
            await challenge.save();
            
            // Update state
            challengeState.stage = 'accepted';
            challengeState.startedAt = new Date();
            
            return {
                success: true,
                challengeId,
                message: '✅ Challenge accepted! Starting now...'
            };
            
        } catch (error) {
            console.error('Accept Challenge Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async declineChallenge(challengeId, userId) {
        try {
            const challengeState = this.challengeStates.get(challengeId);
            if (!challengeState) {
                throw new Error('Challenge not found');
            }
            
            if (challengeState.opponentId !== userId) {
                throw new Error('Only the challenged user can decline');
            }
            
            // Update database
            const challenge = await Challenge.findOne({ challengeId });
            if (!challenge) {
                throw new Error('Challenge not found in database');
            }
            
            challenge.status = 'declined';
            challenge.completedAt = new Date();
            await challenge.save();
            
            // Remove from active challenges
            this.challengeStates.delete(challengeId);
            
            return {
                success: true,
                challengeId,
                message: '❌ Challenge declined'
            };
            
        } catch (error) {
            console.error('Decline Challenge Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async startChallenge(challengeId, botClient) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState) return null;
        
        challengeState.stage = 'in_progress';
        
        // Send first question to challenger
        await this.sendQuestionToPlayer(challengeId, challengeState.challengerId, botClient);
        
        return challengeState;
    }
    
    async sendQuestionToPlayer(challengeId, playerId, botClient) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState) return null;
        
        const challenge = await Challenge.findOne({ challengeId });
        if (!challenge) return null;
        
        if (challengeState.currentQuestion >= challenge.questions.length) {
            return await this.endChallenge(challengeId, botClient);
        }
        
        const question = challenge.questions[challengeState.currentQuestion];
        
        await botClient.sendQuizQuestion(
            playerId,
            question,
            challengeState.currentQuestion + 1,
            challenge.questions.length
        );
        
        // Set timeout for this question
        challengeState.questionTimeout = setTimeout(async () => {
            await this.handleChallengeQuestionTimeout(challengeId, playerId, botClient);
        }, 30000);
        
        return question;
    }
    
    async handleChallengeAnswer(challengeId, playerId, answerIndex, botClient) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState) return null;
        
        const challenge = await Challenge.findOne({ challengeId });
        if (!challenge) return null;
        
        // Clear timeout
        if (challengeState.questionTimeout) {
            clearTimeout(challengeState.questionTimeout);
            challengeState.questionTimeout = null;
        }
        
        const question = challenge.questions[challengeState.currentQuestion];
        const answer = question.options[answerIndex];
        const isCorrect = answer === question.correctAnswer;
        const points = isCorrect ? question.points : 0;
        
        // Update player's answers
        if (playerId === challengeState.challengerId) {
            challengeState.challengerAnswers.push({
                questionIndex: challengeState.currentQuestion,
                answer,
                isCorrect,
                pointsEarned: points,
                answeredAt: new Date()
            });
            challenge.challengerScore += points;
        } else {
            challengeState.opponentAnswers.push({
                questionIndex: challengeState.currentQuestion,
                answer,
                isCorrect,
                pointsEarned: points,
                answeredAt: new Date()
            });
            challenge.opponentScore += points;
        }
        
        // Send result to player
        if (isCorrect) {
            await botClient.sendMessage(playerId, {
                text: `✅ *Correct!* +${points} points\n\nCorrect answer: *${question.correctAnswer}*`
            });
        } else {
            await botClient.sendMessage(playerId, {
                text: `❌ *Incorrect!*\n\nCorrect answer: *${question.correctAnswer}*`
            });
        }
        
        // Move to next question
        challengeState.currentQuestion++;
        
        // Determine next player
        if (challengeState.currentQuestion < challenge.questions.length) {
            challengeState.isChallengerTurn = !challengeState.isChallengerTurn;
            const nextPlayerId = challengeState.isChallengerTurn ? 
                challengeState.challengerId : challengeState.opponentId;
            
            // Send next question after delay
            setTimeout(async () => {
                await this.sendQuestionToPlayer(challengeId, nextPlayerId, botClient);
            }, 2000);
        } else {
            // End challenge after delay
            setTimeout(async () => {
                await this.endChallenge(challengeId, botClient);
            }, 2000);
        }
        
        // Save challenge progress
        await challenge.save();
        
        return {
            success: true,
            isCorrect,
            points,
            currentQuestion: challengeState.currentQuestion,
            totalQuestions: challenge.questions.length
        };
    }
    
    async handleChallengeQuestionTimeout(challengeId, playerId, botClient) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState) return;
        
        const challenge = await Challenge.findOne({ challengeId });
        if (!challenge) return;
        
        const question = challenge.questions[challengeState.currentQuestion];
        
        await botClient.sendMessage(playerId, {
            text: `⏰ *Time's Up!*\n\nCorrect answer: *${question.correctAnswer}*`
        });
        
        // Move to next question
        challengeState.currentQuestion++;
        
        if (challengeState.currentQuestion < challenge.questions.length) {
            challengeState.isChallengerTurn = !challengeState.isChallengerTurn;
            const nextPlayerId = challengeState.isChallengerTurn ? 
                challengeState.challengerId : challengeState.opponentId;
            
            setTimeout(async () => {
                await this.sendQuestionToPlayer(challengeId, nextPlayerId, botClient);
            }, 2000);
        } else {
            setTimeout(async () => {
                await this.endChallenge(challengeId, botClient);
            }, 2000);
        }
    }
    
    async endChallenge(challengeId, botClient) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState) return null;
        
        const challenge = await Challenge.findOne({ challengeId });
        if (!challenge) return null;
        
        // Update challenge in database
        challenge.status = 'completed';
        challenge.completedAt = new Date();
        challenge.challengerScore = challengeState.challengerAnswers.reduce((sum, ans) => sum + ans.pointsEarned, 0);
        challenge.opponentScore = challengeState.opponentAnswers.reduce((sum, ans) => sum + ans.pointsEarned, 0);
        
        // Determine winner
        if (challenge.challengerScore > challenge.opponentScore) {
            challenge.winnerId = challenge.challengerId;
            challenge.winnerName = challenge.challengerName;
        } else if (challenge.opponentScore > challenge.challengerScore) {
            challenge.winnerId = challenge.opponentId;
            challenge.winnerName = challenge.opponentName;
        }
        
        await challenge.save();
        
        // Update user stats
        await this.updateChallengeStats(challenge);
        
        // Send results to both players
        const resultText = this.getChallengeResultText(challenge);
        
        await botClient.sendMessage(challenge.challengerId, { text: resultText });
        await botClient.sendMessage(challenge.opponentId, { text: resultText });
        
        // Remove from active challenges
        this.challengeStates.delete(challengeId);
        
        return {
            success: true,
            challenge,
            resultText
        };
    }
    
    async updateChallengeStats(challenge) {
        try {
            // Update challenger stats
            const challenger = await User.findOne({ userId: challenge.challengerId });
            if (challenger) {
                challenger.totalChallenges += 1;
                challenger.points += challenge.challengerScore;
                
                if (challenge.winnerId === challenge.challengerId) {
                    challenger.challengesWon += 1;
                }
                
                const correctAnswers = challenge.challengerAnswers.filter(a => a.isCorrect).length;
                challenger.correctAnswers += correctAnswers;
                challenger.totalAnswers += challenge.numQuestions;
                
                await challenger.save();
            }
            
            // Update opponent stats
            const opponent = await User.findOne({ userId: challenge.opponentId });
            if (opponent) {
                opponent.totalChallenges += 1;
                opponent.points += challenge.opponentScore;
                
                if (challenge.winnerId === challenge.opponentId) {
                    opponent.challengesWon += 1;
                }
                
                const correctAnswers = challenge.opponentAnswers.filter(a => a.isCorrect).length;
                opponent.correctAnswers += correctAnswers;
                opponent.totalAnswers += challenge.numQuestions;
                
                await opponent.save();
            }
            
        } catch (error) {
            console.error('Update Challenge Stats Error:', error);
        }
    }
    
    getChallengeResultText(challenge) {
        let text = `⚔️ *Challenge Results!*\n\n`;
        text += `🎯 Category: *${challenge.category}*\n`;
        text += `📊 Difficulty: *${challenge.difficulty}*\n\n`;
        text += `👤 ${challenge.challengerName}: *${challenge.challengerScore}* points\n`;
        text += `👤 ${challenge.opponentName}: *${challenge.opponentScore}* points\n\n`;
        
        if (challenge.winnerId) {
            text += `🏆 *Winner:* ${challenge.winnerName}!\n`;
            text += `🎉 Congratulations!`;
        } else {
            text += `🤝 *It's a tie!*`;
        }
        
        return text;
    }
    
    async handleChallengeExpiration(challengeId) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState || challengeState.stage !== 'pending') return;
        
        // Update database
        const challenge = await Challenge.findOne({ challengeId });
        if (challenge && challenge.status === 'pending') {
            challenge.status = 'expired';
            challenge.completedAt = new Date();
            await challenge.save();
        }
        
        // Remove from active challenges
        this.challengeStates.delete(challengeId);
        
        // Notify challenger
        // (This would require access to bot client, handled elsewhere)
    }
    
    async getChallengeStatus(challengeId) {
        const challengeState = this.challengeStates.get(challengeId);
        if (!challengeState) return null;
        
        const challenge = await Challenge.findOne({ challengeId });
        if (!challenge) return null;
        
        return {
            challengeId,
            challenger: challengeState.challengerName,
            opponent: challengeState.opponentName,
            category: challengeState.category,
            difficulty: challengeState.difficulty,
            stage: challengeState.stage,
            currentQuestion: challengeState.currentQuestion,
            totalQuestions: challenge.numQuestions,
            challengerScore: challenge.challengerScore || 0,
            opponentScore: challenge.opponentScore || 0
        };
    }
}

module.exports = new ChallengeManager();