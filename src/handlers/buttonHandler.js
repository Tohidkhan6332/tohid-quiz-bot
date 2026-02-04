const config = require('../config');
const TohidUtils = require('../lib/TohidUtils');
const TohidCache = require('../lib/TohidCache');
const QuizSessionManager = require('../quiz/quizSession');
const ChallengeManager = require('../quiz/quizChallenge');
const { User, Group } = require('../database/Tohidmodels');

class ButtonHandler {
    constructor(botClient) {
        this.bot = botClient;
    }
    
    async handle(m, botClient) {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            // Check for button response
            if (!msg.message.buttonsResponseMessage) return;
            
            const buttonResponse = msg.message.buttonsResponseMessage;
            const selectedButtonId = buttonResponse.selectedButtonId;
            const sender = msg.key.remoteJid;
            const isGroup = sender.endsWith('@g.us');
            const groupId = isGroup ? sender : null;
            const userId = msg.key.participant || sender;
            
            console.log(`Button clicked: ${selectedButtonId} by ${userId}`);
            
            // Handle different button types
            if (selectedButtonId.startsWith('cat_')) {
                await this.handleCategorySelection(userId, groupId, selectedButtonId);
            } else if (selectedButtonId.startsWith('diff_')) {
                await this.handleDifficultySelection(userId, groupId, selectedButtonId);
            } else if (selectedButtonId.startsWith('ans_')) {
                await this.handleAnswerSelection(userId, groupId, selectedButtonId);
            } else if (selectedButtonId.startsWith('accept_')) {
                await this.handleChallengeAccept(userId, selectedButtonId);
            } else if (selectedButtonId.startsWith('decline_')) {
                await this.handleChallengeDecline(userId, selectedButtonId);
            } else {
                await this.handleMenuButton(userId, selectedButtonId);
            }
            
        } catch (error) {
            console.error('Button Handler Error:', error);
        }
    }
    
    async handleCategorySelection(userId, groupId, buttonId) {
        try {
            const category = buttonId.replace('cat_', '');
            const categoryConfig = config.CATEGORIES[category];
            
            if (!categoryConfig) {
                await this.bot.sendMessage(userId, {
                    text: '❌ Invalid category selected.'
                });
                return;
            }
            
            if (groupId) {
                // Group quiz category selection
                const quizState = TohidCache.getTempData(`quiz_start_${groupId}`);
                if (quizState && quizState.userId === userId.replace('@s.whatsapp.net', '')) {
                    TohidCache.setTempData(`quiz_start_${groupId}`, {
                        ...quizState,
                        category: categoryConfig.name,
                        stage: 'difficulty'
                    }, 300);
                    
                    await this.bot.sendDifficultyMenu(groupId);
                }
            } else {
                // Personal challenge category selection
                const challengeState = TohidCache.getTempData(`challenge_${userId}`);
                if (challengeState) {
                    TohidCache.setTempData(`challenge_${userId}`, {
                        ...challengeState,
                        category: categoryConfig.name,
                        stage: 'difficulty'
                    }, 300);
                    
                    await this.bot.sendDifficultyMenu(userId);
                }
            }
            
        } catch (error) {
            console.error('Category Selection Error:', error);
        }
    }
    
    async handleDifficultySelection(userId, groupId, buttonId) {
        try {
            const difficulty = buttonId.replace('diff_', '');
            
            if (!['easy', 'medium', 'hard'].includes(difficulty)) {
                await this.bot.sendMessage(userId, {
                    text: '❌ Invalid difficulty selected.'
                });
                return;
            }
            
            if (groupId) {
                // Group quiz difficulty selection
                const quizState = TohidCache.getTempData(`quiz_start_${groupId}`);
                if (quizState && quizState.userId === userId.replace('@s.whatsapp.net', '')) {
                    // Start the quiz
                    const result = await QuizSessionManager.createSession(
                        groupId,
                        quizState.userId,
                        'User', // Name will be fetched from database
                        quizState.category,
                        difficulty,
                        10
                    );
                    
                    if (result.success) {
                        await this.bot.sendMessage(groupId, {
                            text: result.message
                        });
                        
                        // Start first question after delay
                        setTimeout(async () => {
                            await QuizSessionManager.startQuestion(result.sessionId, this.bot);
                        }, 3000);
                    } else {
                        await this.bot.sendMessage(groupId, {
                            text: `❌ ${result.error}`
                        });
                    }
                    
                    TohidCache.deleteTempData(`quiz_start_${groupId}`);
                }
            } else {
                // Personal challenge difficulty selection
                const challengeState = TohidCache.getTempData(`challenge_${userId}`);
                if (challengeState) {
                    const user = await User.findOne({ userId });
                    if (!user) return;
                    
                    // Create challenge
                    const result = await ChallengeManager.createChallenge(
                        userId,
                        user.name,
                        challengeState.opponentId,
                        challengeState.opponentName,
                        challengeState.category,
                        difficulty
                    );
                    
                    if (result.success) {
                        await this.bot.sendMessage(userId, {
                            text: result.message
                        });
                        
                        // Send challenge notification to opponent
                        await this.bot.sendMessage(challengeState.opponentId, {
                            text: `⚔️ *Challenge Request!*\n\n${user.name} has challenged you!\n\nCategory: *${challengeState.category}*\nDifficulty: *${difficulty}*\n\nDo you accept?`,
                            buttons: [
                                [
                                    {
                                        buttonId: `accept_${result.challengeId}`,
                                        buttonText: { displayText: '✅ Accept' },
                                        type: 1
                                    },
                                    {
                                        buttonId: `decline_${result.challengeId}`,
                                        buttonText: { displayText: '❌ Decline' },
                                        type: 1
                                    }
                                ]
                            ]
                        });
                    } else {
                        await this.bot.sendMessage(userId, {
                            text: `❌ ${result.error}`
                        });
                    }
                    
                    TohidCache.deleteTempData(`challenge_${userId}`);
                }
            }
            
        } catch (error) {
            console.error('Difficulty Selection Error:', error);
        }
    }
    
    async handleAnswerSelection(userId, groupId, buttonId) {
        try {
            const answerIndex = parseInt(buttonId.replace('ans_', ''));
            
            if (isNaN(answerIndex) || answerIndex < 0 || answerIndex > 3) {
                return;
            }
            
            // Get active session for group
            const activeSession = await QuizSessionManager.getActiveSession(groupId);
            if (!activeSession) return;
            
            // Get user info
            const user = await User.findOne({ userId });
            if (!user) return;
            
            // Handle answer
            await QuizSessionManager.handleAnswer(
                activeSession.sessionId,
                userId,
                user.name,
                answerIndex,
                this.bot
            );
            
        } catch (error) {
            console.error('Answer Selection Error:', error);
        }
    }
    
    async handleChallengeAccept(userId, buttonId) {
        try {
            const challengeId = buttonId.replace('accept_', '');
            
            const result = await ChallengeManager.acceptChallenge(challengeId, userId);
            
            if (result.success) {
                await this.bot.sendMessage(userId, {
                    text: result.message
                });
                
                // Start the challenge
                await ChallengeManager.startChallenge(challengeId, this.bot);
            } else {
                await this.bot.sendMessage(userId, {
                    text: `❌ ${result.error}`
                });
            }
            
        } catch (error) {
            console.error('Challenge Accept Error:', error);
        }
    }
    
    async handleChallengeDecline(userId, buttonId) {
        try {
            const challengeId = buttonId.replace('decline_', '');
            
            const result = await ChallengeManager.declineChallenge(challengeId, userId);
            
            if (result.success) {
                await this.bot.sendMessage(userId, {
                    text: result.message
                });
                
                // Notify challenger
                const challengeState = ChallengeManager.challengeStates.get(challengeId);
                if (challengeState) {
                    await this.bot.sendMessage(challengeState.challengerId, {
                        text: `❌ *Challenge Declined*\n\n${challengeState.opponentName} has declined your challenge.`
                    });
                }
            }
            
        } catch (error) {
            console.error('Challenge Decline Error:', error);
        }
    }
    
    async handleMenuButton(userId, buttonId) {
        try {
            const user = await User.findOne({ userId });
            const userName = user?.name || 'User';
            
            switch(buttonId) {
                case 'groupquiz':
                    await this.bot.sendMessage(userId, {
                        text: '🎮 *Group Quiz*\n\nUse !groupquiz in a WhatsApp group to start a quiz battle!'
                    });
                    break;
                    
                case 'challenge':
                    await this.bot.sendMessage(userId, {
                        text: '⚔️ *Challenge*\n\nUse !challenge @user to challenge someone.\nExample: !challenge @918765432100'
                    });
                    break;
                    
                case 'leaderboard':
                    // Get leaderboard
                    const topUsers = await require('../database/Tohidmodels').User
                        .find({ isBlocked: false })
                        .sort({ points: -1 })
                        .limit(10);
                    
                    let leaderboardText = `🏆 *Leaderboard*\n\n`;
                    topUsers.forEach((u, index) => {
                        const medal = index === 0 ? '🥇' : 
                                     index === 1 ? '🥈' : 
                                     index === 2 ? '🥉' : `${index + 1}.`;
                        leaderboardText += `${medal} ${u.name}: ${u.points} points\n`;
                    });
                    
                    await this.bot.sendMessage(userId, { text: leaderboardText });
                    break;
                    
                case 'mystats':
                    if (!user) {
                        await this.bot.sendMessage(userId, {
                            text: '❌ Please use !start first to create your profile.'
                        });
                        return;
                    }
                    
                    const statsText = `📊 *Your Stats*\n\n` +
                        `👤 Name: ${user.name}\n` +
                        `🏆 Points: ${user.points}\n` +
                        `⭐ Rank: ${user.rank}\n` +
                        `🎯 Accuracy: ${user.accuracy}%\n` +
                        `🎮 Quizzes: ${user.totalQuizzes}\n` +
                        `⚔️ Challenges: ${user.totalChallenges}`;
                    
                    await this.bot.sendMessage(userId, { text: statsText });
                    break;
                    
                case 'history':
                    await this.bot.sendMessage(userId, {
                        text: '📖 *History*\n\nUse !history to see your quiz history.'
                    });
                    break;
                    
                case 'about':
                    await this.bot.sendMessage(userId, {
                        text: `🤖 *${config.BOT_NAME}*\n\nDeveloped by ${config.OWNER_NAME}\nContact: ${config.OWNER_NUMBER}\nWebsite: ${config.QUIZ_WEB}\n\n💡 Code by Tohid ✨`
                    });
                    break;
                    
                case 'admin':
                    if (TohidUtils.isAdmin(userId)) {
                        await this.bot.sendMessage(userId, {
                            text: '🛠️ *Admin Panel*\n\nUse !helpadmin to see admin commands.'
                        });
                    }
                    break;
                    
                default:
                    // Send main menu for unknown buttons
                    await this.bot.sendMainMenu(userId, userName);
            }
            
        } catch (error) {
            console.error('Menu Button Error:', error);
        }
    }
}

module.exports = ButtonHandler;