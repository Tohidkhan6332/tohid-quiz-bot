const config = require('../config');
const TohidUtils = require('../lib/TohidUtils');
const QuizSessionManager = require('../quiz/quizSession');
const ChallengeManager = require('../quiz/quizChallenge');
const { User, QuizHistory, Group } = require('../database/Tohidmodels');

class PublicCommands {
    constructor(botClient) {
        this.bot = botClient;
    }
    
    async handleCommand(userId, command, args, isGroup, groupId = null) {
        switch(command) {
            case 'start':
                return await this.handleStart(userId);
            case 'menu':
                return await this.handleMenu(userId);
            case 'help':
                return await this.handleHelp(userId, isGroup);
            case 'stats':
                return await this.handleStats(userId);
            case 'leaderboard':
                return await this.handleLeaderboard(userId);
            case 'history':
                return await this.handleHistory(userId);
            case 'about':
                return await this.handleAbout(userId);
            case 'ping':
                return await this.handlePing(userId);
            case 'groupquiz':
                if (!isGroup) {
                    return await this.bot.sendMessage(userId, {
                        text: '❌ This command only works in groups!'
                    });
                }
                return await this.handleGroupQuiz(groupId, userId, args);
            case 'stopgroupquiz':
                if (!isGroup) {
                    return await this.bot.sendMessage(userId, {
                        text: '❌ This command only works in groups!'
                    });
                }
                return await this.handleStopGroupQuiz(groupId, userId);
            case 'grouprank':
                if (!isGroup) {
                    return await this.bot.sendMessage(userId, {
                        text: '❌ This command only works in groups!'
                    });
                }
                return await this.handleGroupRank(groupId);
            case 'challenge':
                return await this.handleChallenge(userId, args);
            case 'challengerank':
                return await this.handleChallengeRank(userId);
            case 'id':
                if (!isGroup) {
                    return await this.bot.sendMessage(userId, {
                        text: '❌ This command only works in groups!'
                    });
                }
                return await this.handleGroupId(groupId);
            default:
                return await this.bot.sendMessage(userId, {
                    text: '❌ Unknown command. Use !help to see available commands.'
                });
        }
    }
    
    async handleStart(userId) {
        try {
            // Get or create user
            let user = await User.findOne({ userId });
            if (!user) {
                const userInfo = await this.bot.sock.onWhatsApp(userId);
                const userName = userInfo[0]?.name || 'User';
                
                user = new User({
                    userId,
                    name: userName,
                    phone: userId.replace('@s.whatsapp.net', ''),
                    createdAt: new Date()
                });
                await user.save();
            }
            
            // Update last active
            user.lastActive = new Date();
            await user.save();
            
            // Send welcome message
            const welcomeText = `🎉 *Welcome ${user.name}!* 🤖\n\n*${config.BOT_NAME}* is here to test your knowledge!\n\n📌 *Features:*\n• 🎮 Group Quiz Battles\n• ⚔️ 1v1 Challenges\n• 🏆 Global Leaderboard\n• 📊 Detailed Statistics\n• 🎯 Multiple Categories\n\n👨‍💻 *Developer:* ${config.OWNER_NAME}\n📞 *Contact:* ${config.OWNER_NUMBER}\n🌐 *Website:* ${config.QUIZ_WEB}\n👥 *Group:* ${config.WHATSAPP_GROUP}\n📢 *Channel:* ${config.WHATSAPP_CHANNEL}\n\n💡 *Code by Tohid* ✨`;
            
            return await this.bot.sendMainMenu(userId, user.name);
            
        } catch (error) {
            console.error('Start Command Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ An error occurred. Please try again.'
            });
        }
    }
    
    async handleMenu(userId) {
        return await this.bot.sendMainMenu(userId);
    }
    
    async handleHelp(userId, isGroup = false) {
        let helpText = `📖 *${config.BOT_NAME} Help*\n\n`;
        
        if (isGroup) {
            helpText += `*Group Commands:*\n`;
            helpText += `• !groupquiz - Start a group quiz\n`;
            helpText += `• !stopgroupquiz - Stop active quiz\n`;
            helpText += `• !grouprank - Show group leaderboard\n`;
            helpText += `• !challenge @user - Challenge someone\n`;
            helpText += `• !id - Show group ID for admin commands\n\n`;
        }
        
        helpText += `*Personal Commands:*\n`;
        helpText += `• !start - Start the bot\n`;
        helpText += `• !menu - Show main menu\n`;
        helpText += `• !stats - Your statistics\n`;
        helpText += `• !leaderboard - Global leaderboard\n`;
        helpText += `• !history - Your quiz history\n`;
        helpText += `• !challenge @user - Challenge someone\n`;
        helpText += `• !about - About the bot\n`;
        helpText += `• !ping - Check bot status\n\n`;
        
        helpText += `*How to Play:*\n`;
        helpText += `1. Use !groupquiz in a group\n`;
        helpText += `2. Select category & difficulty\n`;
        helpText += `3. Answer questions using buttons\n`;
        helpText += `4. Earn points and climb ranks!\n\n`;
        
        helpText += `💡 *Tip:* Use buttons for better experience!`;
        
        return await this.bot.sendMessage(userId, { text: helpText });
    }
    
    async handleStats(userId) {
        try {
            const user = await User.findOne({ userId });
            if (!user) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ User not found. Please use !start first.'
                });
            }
            
            // Calculate win rates
            const quizWinRate = user.totalQuizzes > 0 ? 
                Math.round((user.quizzesWon / user.totalQuizzes) * 100) : 0;
            
            const challengeWinRate = user.totalChallenges > 0 ? 
                Math.round((user.challengesWon / user.totalChallenges) * 100) : 0;
            
            const statsText = `📊 *Your Statistics*\n\n` +
                `👤 *Name:* ${user.name}\n` +
                `🏆 *Points:* ${TohidUtils.formatNumber(user.points)}\n` +
                `⭐ *Rank:* ${user.rank}\n` +
                `📈 *Level:* ${user.level}\n` +
                `🎯 *Accuracy:* ${user.accuracy}%\n\n` +
                `📚 *Quiz Stats:*\n` +
                `• Played: ${user.totalQuizzes}\n` +
                `• Won: ${user.quizzesWon} (${quizWinRate}%)\n` +
                `• Correct: ${user.correctAnswers}/${user.totalAnswers}\n\n` +
                `⚔️ *Challenge Stats:*\n` +
                `• Played: ${user.totalChallenges}\n` +
                `• Won: ${user.challengesWon} (${challengeWinRate}%)\n\n` +
                `🕒 *Last Active:* ${user.lastActive.toLocaleDateString()}\n` +
                `📅 *Joined:* ${user.createdAt.toLocaleDateString()}`;
            
            return await this.bot.sendMessage(userId, { text: statsText });
            
        } catch (error) {
            console.error('Stats Command Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Error fetching statistics. Please try again.'
            });
        }
    }
    
    async handleLeaderboard(userId) {
        try {
            // Get top 10 users
            const topUsers = await User.find({ isBlocked: false })
                .sort({ points: -1 })
                .limit(10);
            
            let leaderboardText = `🏆 *Global Leaderboard*\n\n`;
            
            topUsers.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : 
                             index === 1 ? '🥈' : 
                             index === 2 ? '🥉' : `${index + 1}.`;
                
                leaderboardText += `${medal} *${user.name}*\n`;
                leaderboardText += `   📊 ${TohidUtils.formatNumber(user.points)} points | ${user.rank}\n`;
            });
            
            // Add current user's position if not in top 10
            const currentUser = await User.findOne({ userId });
            if (currentUser) {
                const userCount = await User.countDocuments({ 
                    points: { $gt: currentUser.points },
                    isBlocked: false 
                });
                const position = userCount + 1;
                
                leaderboardText += `\n📌 *Your Position:* #${position}`;
            }
            
            leaderboardText += `\n\n💡 Keep playing to climb the ranks!`;
            
            return await this.bot.sendMessage(userId, { text: leaderboardText });
            
        } catch (error) {
            console.error('Leaderboard Command Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Error fetching leaderboard. Please try again.'
            });
        }
    }
    
    async handleHistory(userId, limit = 5) {
        try {
            const history = await QuizHistory.find({ userId })
                .sort({ playedAt: -1 })
                .limit(limit);
            
            if (history.length === 0) {
                return await this.bot.sendMessage(userId, {
                    text: '📭 No quiz history found. Play some quizzes first!'
                });
            }
            
            let historyText = `📖 *Your Recent Quizzes*\n\n`;
            
            history.forEach((item, index) => {
                const date = new Date(item.playedAt).toLocaleDateString();
                const typeIcon = item.type === 'challenge' ? '⚔️' : '🎮';
                
                historyText += `${index + 1}. ${typeIcon} *${item.category}*\n`;
                historyText += `   📊 ${item.score} points | ${item.correctAnswers}/${item.totalQuestions} correct\n`;
                historyText += `   🏆 Position: #${item.position || 'N/A'}\n`;
                historyText += `   📅 ${date}\n`;
                
                if (item.type === 'challenge' && item.opponentName) {
                    historyText += `   vs ${item.opponentName}\n`;
                }
                
                historyText += '\n';
            });
            
            return await this.bot.sendMessage(userId, { text: historyText });
            
        } catch (error) {
            console.error('History Command Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Error fetching history. Please try again.'
            });
        }
    }
    
    async handleAbout(userId) {
        const aboutText = `🤖 *${config.BOT_NAME}*\n\n` +
            `👨‍💻 *Developer:* ${config.OWNER_NAME}\n` +
            `📞 *Contact:* ${config.OWNER_NUMBER}\n` +
            `🌐 *Website:* ${config.QUIZ_WEB}\n` +
            `👥 *Support Group:* ${config.WHATSAPP_GROUP}\n` +
            `📢 *Channel:* ${config.WHATSAPP_CHANNEL}\n\n` +
            `📚 *Features:*\n` +
            `• 🎮 Interactive Group Quizzes\n` +
            `• ⚔️ 1v1 Challenges\n` +
            `• 🏆 Real-time Leaderboard\n` +
            `• 📊 Detailed Statistics\n` +
            `• 🎯 Multiple Categories\n` +
            `• ⚡ Fast & Responsive\n\n` +
            `💡 *Code by Tohid* ✨\n` +
            `Made with ❤️ for quiz enthusiasts!`;
        
        return await this.bot.sendMessage(userId, { text: aboutText });
    }
    
    async handlePing(userId) {
        const pingText = `🏓 *Pong!*\n\n` +
            `✅ ${config.BOT_NAME} is online!\n` +
            `🕒 Server Time: ${new Date().toLocaleString()}\n` +
            `⚡ Status: Active & Ready\n\n` +
            `💡 Bot is working perfectly!`;
        
        return await this.bot.sendMessage(userId, { text: pingText });
    }
    
    async handleGroupQuiz(groupId, userId, args) {
        try {
            // Check if bot is enabled in group
            const group = await Group.findOne({ groupId });
            if (!group || !group.botEnabled) {
                return await this.bot.sendMessage(groupId, {
                    text: '❌ Bot is not enabled in this group. Contact admin.'
                });
            }
            
            // Check if there's already an active quiz
            const activeSession = await QuizSessionManager.getActiveSession(groupId);
            if (activeSession) {
                return await this.bot.sendMessage(groupId, {
                    text: '❌ A quiz is already active in this group!'
                });
            }
            
            // Send category selection
            await this.bot.sendCategoryMenu(groupId, '🎮 *Starting Group Quiz!*\n\nSelect category:');
            
            // Store session state
            TohidCache.setTempData(`quiz_start_${groupId}`, {
                userId,
                stage: 'category'
            }, 300);
            
        } catch (error) {
            console.error('Group Quiz Command Error:', error);
            return await this.bot.sendMessage(groupId, {
                text: '❌ Error starting quiz. Please try again.'
            });
        }
    }
    
    async handleStopGroupQuiz(groupId, userId) {
        try {
            const result = await QuizSessionManager.stopSession(groupId, userId);
            
            if (result?.success) {
                return await this.bot.sendMessage(groupId, {
                    text: '✅ Quiz stopped successfully!'
                });
            } else {
                return await this.bot.sendMessage(groupId, {
                    text: result?.error || '❌ No active quiz found in this group.'
                });
            }
            
        } catch (error) {
            console.error('Stop Group Quiz Error:', error);
            return await this.bot.sendMessage(groupId, {
                text: '❌ Error stopping quiz. Please try again.'
            });
        }
    }
    
    async handleGroupRank(groupId) {
        try {
            // Get recent quizzes for this group
            const recentQuizzes = await require('../database/Tohidmodels').QuizSession
                .find({ groupId, isActive: false })
                .sort({ endedAt: -1 })
                .limit(3);
            
            if (recentQuizzes.length === 0) {
                return await this.bot.sendMessage(groupId, {
                    text: '📊 No quiz history found for this group. Start a quiz with !groupquiz'
                });
            }
            
            let rankText = `🏆 *Group Leaderboard*\n\n`;
            
            recentQuizzes.forEach((quiz, quizIndex) => {
                const date = new Date(quiz.endedAt).toLocaleDateString();
                
                rankText += `*Quiz ${quizIndex + 1}:* ${quiz.category} (${quiz.difficulty})\n`;
                rankText += `📅 ${date}\n`;
                
                // Show top 3 participants
                const topParticipants = quiz.participants
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);
                
                topParticipants.forEach((participant, index) => {
                    const medal = index === 0 ? '🥇' : 
                                 index === 1 ? '🥈' : 
                                 index === 2 ? '🥉' : `${index + 1}.`;
                    
                    rankText += `${medal} ${participant.name}: ${participant.score} points\n`;
                });
                
                rankText += '\n';
            });
            
            return await this.bot.sendMessage(groupId, { text: rankText });
            
        } catch (error) {
            console.error('Group Rank Error:', error);
            return await this.bot.sendMessage(groupId, {
                text: '❌ Error fetching group rank. Please try again.'
            });
        }
    }
    
    async handleGroupId(groupId) {
        try {
            const groupInfo = await this.bot.getGroupMetadata(groupId);
            if (!groupInfo) {
                return await this.bot.sendMessage(groupId, {
                    text: '❌ Error fetching group information. Make sure bot is admin in this group.'
                });
            }
            
            const groupName = groupInfo.subject || 'Unknown Group';
            const participants = groupInfo.participants || [];
            const admins = participants.filter(p => p.admin).map(p => p.id);
            const botIsAdmin = participants.some(p => p.id === this.bot.sock.user?.id && p.admin);
            
            const idText = `📋 *Group Information - ${config.BOT_NAME}*\n\n` +
                `🏷️ *Group Name:* ${groupName}\n` +
                `🔢 *Group ID:* \`${groupId}\`\n` +
                `👥 *Total Members:* ${participants.length}\n` +
                `👑 *Admins:* ${admins.length}\n` +
                `🤖 *Bot Status:* ${botIsAdmin ? 'Admin ✅' : 'Not Admin ❌'}\n` +
                `📅 *Created:* ${new Date(groupInfo.creation * 1000).toLocaleDateString()}\n\n` +
                `🔧 *Admin Commands (use with Group ID):*\n` +
                `• \`!enablebot ${groupId}\` - Enable bot\n` +
                `• \`!disablebot ${groupId}\` - Disable bot\n` +
                `• \`!addgroup ${groupId} "${groupName}"\` - Add group\n` +
                `• \`!removegroup ${groupId}\` - Remove group\n\n` +
                `💡 *Instructions:*\n` +
                `1. Copy the Group ID above\n` +
                `2. Send to bot owner/admin\n` +
                `3. Use with admin commands\n` +
                `4. Make bot admin for full features`;
            
            return await this.bot.sendMessage(groupId, { text: idText });
            
        } catch (error) {
            console.error('Group ID Command Error:', error);
            return await this.bot.sendMessage(groupId, {
                text: '❌ Error fetching group information. Make sure bot is admin in this group.'
            });
        }
    }
    
    async handleChallenge(userId, args) {
        try {
            if (args.length < 1) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !challenge @user\nExample: !challenge @918765432100'
                });
            }
            
            // Extract mentioned user
            const mentionedUser = TohidUtils.parseMention(args.join(' '))[0];
            if (!mentionedUser) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Please mention a user. Example: !challenge @918765432100'
                });
            }
            
            if (mentionedUser === userId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ You cannot challenge yourself!'
                });
            }
            
            // Get user info
            const challenger = await User.findOne({ userId });
            if (!challenger) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Please use !start first.'
                });
            }
            
            const opponentInfo = await this.bot.sock.onWhatsApp(mentionedUser);
            const opponentName = opponentInfo[0]?.name || 'User';
            
            // Store challenge state
            TohidCache.setTempData(`challenge_${userId}`, {
                opponentId: mentionedUser,
                opponentName,
                stage: 'category'
            }, 300);
            
            // Send category selection
            return await this.bot.sendCategoryMenu(userId, '⚔️ *Creating Challenge!*\n\nSelect category:');
            
        } catch (error) {
            console.error('Challenge Command Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Error creating challenge. Please try again.'
            });
        }
    }
    
    async handleChallengeRank(userId) {
        try {
            const user = await User.findOne({ userId });
            if (!user) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ User not found. Please use !start first.'
                });
            }
            
            // Get top 10 challenge players
            const topChallengers = await User.find({ 
                isBlocked: false,
                totalChallenges: { $gt: 0 }
            })
            .sort({ challengesWon: -1 })
            .limit(10);
            
            let rankText = `⚔️ *Challenge Leaderboard*\n\n`;
            
            topChallengers.forEach((player, index) => {
                const winRate = player.totalChallenges > 0 ? 
                    Math.round((player.challengesWon / player.totalChallenges) * 100) : 0;
                
                const medal = index === 0 ? '🥇' : 
                             index === 1 ? '🥈' : 
                             index === 2 ? '🥉' : `${index + 1}.`;
                
                rankText += `${medal} *${player.name}*\n`;
                rankText += `   ⚔️ ${player.challengesWon}/${player.totalChallenges} won (${winRate}%)\n`;
                rankText += `   🏆 ${player.challengesWon} wins\n`;
            });
            
            // Add current user's stats
            const winRate = user.totalChallenges > 0 ? 
                Math.round((user.challengesWon / user.totalChallenges) * 100) : 0;
            
            rankText += `\n📌 *Your Challenge Stats:*\n`;
            rankText += `• Won: ${user.challengesWon}/${user.totalChallenges} (${winRate}%)\n`;
            rankText += `• Points: ${user.points}\n`;
            
            return await this.bot.sendMessage(userId, { text: rankText });
            
        } catch (error) {
            console.error('Challenge Rank Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Error fetching challenge rank. Please try again.'
            });
        }
    }
}

module.exports = PublicCommands;