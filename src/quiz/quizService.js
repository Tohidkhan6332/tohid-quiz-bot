const axios = require('axios');
const config = require('../config');
const TohidUtils = require('../lib/TohidUtils');
const TohidCache = require('../lib/TohidCache');
const { QuizSession, Challenge, QuizHistory, User } = require('../database/Tohidmodels');

class QuizService {
    constructor() {
        this.activeSessions = new Map();
        this.activeChallenges = new Map();
    }
    
    async fetchQuestions(category, difficulty, amount = 10) {
        try {
            const categoryId = config.CATEGORIES[category.toLowerCase()]?.id;
            if (!categoryId) {
                throw new Error(`Invalid category: ${category}`);
            }
            
            const difficultyLower = difficulty.toLowerCase();
            if (!config.DIFFICULTIES[difficultyLower]) {
                throw new Error(`Invalid difficulty: ${difficulty}`);
            }
            
            const cacheKey = `questions_${category}_${difficulty}_${amount}`;
            const cached = TohidCache.getTempData(cacheKey);
            
            if (cached) {
                return cached;
            }
            
            const response = await axios.get(config.TRIVIA_API, {
                params: {
                    amount: amount,
                    category: categoryId,
                    difficulty: difficultyLower,
                    type: 'multiple',
                    encode: 'url3986'
                },
                timeout: 10000
            });
            
            if (!response.data.results || response.data.results.length === 0) {
                throw new Error('No questions found');
            }
            
            const questions = response.data.results.map(result => ({
                question: TohidUtils.decodeHTML(result.question),
                correctAnswer: TohidUtils.decodeHTML(result.correct_answer),
                options: TohidUtils.shuffleArray([
                    ...result.incorrect_answers.map(incorrect => TohidUtils.decodeHTML(incorrect)),
                    TohidUtils.decodeHTML(result.correct_answer)
                ]),
                difficulty: result.difficulty,
                category: result.category
            }));
            
            TohidCache.setTempData(cacheKey, questions, 300); // Cache for 5 minutes
            
            return questions;
        } catch (error) {
            console.error('Fetch Questions Error:', error.message);
            
            // Return sample questions if API fails
            return this.getSampleQuestions(category, amount);
        }
    }
    
    getSampleQuestions(category, amount) {
        const sampleQuestions = {
            'science': [
                {
                    question: "What is the chemical symbol for water?",
                    correctAnswer: "H2O",
                    options: ["H2O", "CO2", "NaCl", "O2"],
                    difficulty: "easy",
                    category: "Science"
                },
                {
                    question: "Which planet is known as the Red Planet?",
                    correctAnswer: "Mars",
                    options: ["Mars", "Jupiter", "Venus", "Saturn"],
                    difficulty: "easy",
                    category: "Science"
                }
            ],
            'history': [
                {
                    question: "Who was the first President of India?",
                    correctAnswer: "Rajendra Prasad",
                    options: ["Rajendra Prasad", "Jawaharlal Nehru", "Sardar Patel", "Dr. Ambedkar"],
                    difficulty: "medium",
                    category: "History"
                }
            ]
            // Add more sample questions for other categories
        };
        
        return sampleQuestions[category.toLowerCase()]?.slice(0, amount) || [];
    }
    
    async createGroupQuiz(groupId, userId, userName, category, difficulty, numQuestions = 10) {
        try {
            // Check if group already has active quiz
            const existingQuiz = await QuizSession.findOne({
                groupId,
                isActive: true
            });
            
            if (existingQuiz) {
                throw new Error('A quiz is already active in this group!');
            }
            
            // Fetch questions
            const questions = await this.fetchQuestions(category, difficulty, numQuestions);
            
            if (questions.length < numQuestions) {
                throw new Error(`Could only fetch ${questions.length} questions. Try a different category or difficulty.`);
            }
            
            const sessionId = TohidUtils.generateId('quiz');
            
            // Create quiz session in database
            const quizSession = new QuizSession({
                sessionId,
                groupId,
                category,
                difficulty,
                numQuestions,
                questions: questions.map((q, index) => ({
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    points: config.DIFFICULTIES[difficulty].points,
                    timeLimit: config.QUESTION_TIMEOUT
                })),
                startedBy: userId,
                isActive: true,
                startedAt: new Date()
            });
            
            await quizSession.save();
            
            // Cache the session
            this.activeSessions.set(sessionId, {
                quizSession,
                currentQuestion: 0,
                participants: new Map(),
                questionStartTime: null,
                timeout: null
            });
            
            // Cache group quiz mapping
            TohidCache.setGroupQuiz(groupId, sessionId);
            
            return {
                success: true,
                sessionId,
                quizSession,
                message: `🎮 *Group Quiz Started!*\n\nCategory: *${category}*\nDifficulty: *${difficulty}*\nQuestions: *${numQuestions}*\n\nStarted by: *${userName}*`
            };
            
        } catch (error) {
            console.error('Create Group Quiz Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getCurrentQuestion(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        
        const { quizSession, currentQuestion } = session;
        if (currentQuestion >= quizSession.questions.length) return null;
        
        return {
            ...quizSession.questions[currentQuestion],
            questionNumber: currentQuestion + 1,
            totalQuestions: quizSession.questions.length
        };
    }
    
    async submitAnswer(sessionId, userId, userName, answerIndex) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Quiz session not found');
            }
            
            const { quizSession, currentQuestion } = session;
            const question = quizSession.questions[currentQuestion];
            
            if (!question) {
                throw new Error('No active question');
            }
            
            const answer = question.options[answerIndex];
            const isCorrect = answer === question.correctAnswer;
            
            // Calculate time taken
            const timeTaken = Date.now() - session.questionStartTime;
            const points = isCorrect ? TohidUtils.calculatePoints(quizSession.difficulty, timeTaken) : 0;
            
            // Update participant in cache
            let participant = session.participants.get(userId);
            if (!participant) {
                participant = {
                    userId,
                    name: userName,
                    score: 0,
                    answers: []
                };
                session.participants.set(userId, participant);
            }
            
            participant.score += points;
            participant.answers.push({
                questionIndex: currentQuestion,
                answer,
                isCorrect,
                pointsEarned: points,
                timeTaken,
                answeredAt: new Date()
            });
            
            // Update database
            const dbParticipant = quizSession.participants.find(p => p.userId === userId);
            if (dbParticipant) {
                dbParticipant.score = participant.score;
                dbParticipant.answers.push({
                    questionIndex: currentQuestion,
                    answer,
                    isCorrect,
                    pointsEarned: points,
                    timeTaken,
                    answeredAt: new Date()
                });
            } else {
                quizSession.participants.push({
                    userId,
                    name: userName,
                    score: participant.score,
                    answers: [{
                        questionIndex: currentQuestion,
                        answer,
                        isCorrect,
                        pointsEarned: points,
                        timeTaken,
                        answeredAt: new Date()
                    }]
                });
            }
            
            await quizSession.save();
            
            return {
                success: true,
                isCorrect,
                correctAnswer: question.correctAnswer,
                points,
                participantScore: participant.score,
                timeTaken
            };
            
        } catch (error) {
            console.error('Submit Answer Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async advanceToNextQuestion(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        
        session.currentQuestion++;
        session.questionStartTime = Date.now();
        
        // Clear previous timeout
        if (session.timeout) {
            clearTimeout(session.timeout);
        }
        
        // Set new timeout for this question
        session.timeout = setTimeout(async () => {
            await this.handleQuestionTimeout(sessionId);
        }, config.QUESTION_TIMEOUT);
        
        return session.currentQuestion;
    }
    
    async handleQuestionTimeout(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        const { quizSession, currentQuestion } = session;
        
        // Move to next question or end quiz
        if (currentQuestion + 1 < quizSession.questions.length) {
            session.currentQuestion++;
            session.questionStartTime = Date.now();
            
            // Set new timeout
            session.timeout = setTimeout(async () => {
                await this.handleQuestionTimeout(sessionId);
            }, config.QUESTION_TIMEOUT);
            
            return {
                action: 'next_question',
                questionNumber: session.currentQuestion + 1
            };
        } else {
            return await this.endQuiz(sessionId);
        }
    }
    
    async endQuiz(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Quiz session not found');
            }
            
            const { quizSession } = session;
            
            // Calculate leaderboard
            const participants = Array.from(session.participants.values())
                .sort((a, b) => b.score - a.score);
            
            // Update quiz session in database
            quizSession.isActive = false;
            quizSession.endedAt = new Date();
            quizSession.leaderboard = participants.map((p, index) => ({
                userId: p.userId,
                name: p.name,
                score: p.score,
                position: index + 1
            }));
            
            if (participants.length > 0) {
                quizSession.winner = {
                    userId: participants[0].userId,
                    name: participants[0].name,
                    score: participants[0].score
                };
            }
            
            await quizSession.save();
            
            // Update user stats
            for (const participant of participants) {
                await this.updateUserStats(participant.userId, participant.score, quizSession);
            }
            
            // Save quiz history
            await this.saveQuizHistory(quizSession, participants);
            
            // Clear from active sessions
            this.activeSessions.delete(sessionId);
            TohidCache.deleteGroupQuiz(quizSession.groupId);
            
            // Clear timeout
            if (session.timeout) {
                clearTimeout(session.timeout);
            }
            
            return {
                success: true,
                leaderboard: participants,
                quizSession
            };
            
        } catch (error) {
            console.error('End Quiz Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async updateUserStats(userId, pointsEarned, quizSession) {
        try {
            const user = await User.findOne({ userId });
            if (!user) return;
            
            user.points += pointsEarned;
            user.totalQuizzes += 1;
            
            if (pointsEarned > 0) {
                const correctAnswers = quizSession.participants
                    .find(p => p.userId === userId)?.answers
                    ?.filter(a => a.isCorrect).length || 0;
                
                user.correctAnswers += correctAnswers;
                user.totalAnswers += quizSession.questions.length;
                
                if (user.totalAnswers > 0) {
                    user.accuracy = Math.round((user.correctAnswers / user.totalAnswers) * 100);
                }
                
                // Check if user won
                const winner = quizSession.leaderboard?.[0];
                if (winner?.userId === userId) {
                    user.quizzesWon += 1;
                }
            }
            
            // Update rank
            user.rank = TohidUtils.getRank(user.points);
            
            await user.save();
            
        } catch (error) {
            console.error('Update User Stats Error:', error);
        }
    }
    
    async saveQuizHistory(quizSession, participants) {
        try {
            for (const participant of participants) {
                const correctAnswers = participant.answers.filter(a => a.isCorrect).length;
                const position = quizSession.leaderboard.findIndex(p => p.userId === participant.userId) + 1;
                
                const history = new QuizHistory({
                    userId: participant.userId,
                    sessionId: quizSession.sessionId,
                    type: 'group',
                    category: quizSession.category,
                    difficulty: quizSession.difficulty,
                    score: participant.score,
                    totalQuestions: quizSession.questions.length,
                    correctAnswers,
                    position,
                    playedAt: quizSession.endedAt,
                    duration: quizSession.endedAt - quizSession.startedAt
                });
                
                await history.save();
            }
        } catch (error) {
            console.error('Save Quiz History Error:', error);
        }
    }
    
    async createChallenge(challengerId, challengerName, opponentId, opponentName, category, difficulty) {
        try {
            const questions = await this.fetchQuestions(category, difficulty, 5);
            
            if (questions.length < 3) {
                throw new Error('Could not fetch enough questions for challenge');
            }
            
            const challengeId = TohidUtils.generateId('challenge');
            
            const challenge = new Challenge({
                challengeId,
                challengerId,
                challengerName,
                opponentId,
                opponentName,
                category,
                difficulty,
                numQuestions: questions.length,
                questions: questions.map(q => ({
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correctAnswer,
                    points: config.DIFFICULTIES[difficulty].points
                })),
                status: 'pending',
                expiresAt: new Date(Date.now() + config.CHALLENGE_TIMEOUT)
            });
            
            await challenge.save();
            
            // Cache the challenge
            this.activeChallenges.set(challengeId, {
                challenge,
                challengerAnswers: [],
                opponentAnswers: [],
                currentQuestion: 0,
                isChallengerTurn: true
            });
            
            TohidCache.setChallenge(challengeId, challenge);
            
            return {
                success: true,
                challengeId,
                challenge,
                message: `⚔️ *Challenge Created!*\n\nChallenger: *${challengerName}*\nOpponent: *${opponentName}*\nCategory: *${category}*\nDifficulty: *${difficulty}*`
            };
            
        } catch (error) {
            console.error('Create Challenge Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getSessionByGroup(groupId) {
        const sessionId = TohidCache.getGroupQuiz(groupId);
        if (!sessionId) return null;
        
        return this.activeSessions.get(sessionId);
    }
    
    async stopQuiz(groupId, userId) {
        try {
            const session = await this.getSessionByGroup(groupId);
            if (!session) {
                throw new Error('No active quiz found');
            }
            
            if (session.quizSession.startedBy !== userId && !TohidUtils.isAdmin(userId)) {
                throw new Error('Only quiz starter or admin can stop the quiz');
            }
            
            return await this.endQuiz(session.quizSession.sessionId);
            
        } catch (error) {
            console.error('Stop Quiz Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getQuizResults(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        
        const participants = Array.from(session.participants.values())
            .sort((a, b) => b.score - a.score);
        
        return {
            sessionId,
            category: session.quizSession.category,
            difficulty: session.quizSession.difficulty,
            totalQuestions: session.quizSession.questions.length,
            participants,
            winner: participants[0]
        };
    }
}

module.exports = new QuizService();