const config = require('../config');
const TohidUtils = require('../lib/TohidUtils');
const TohidCache = require('../lib/TohidCache');
const { User, Group, QuizSession, Challenge } = require('../database/Tohidmodels');

class AdminCommands {
    constructor(botClient) {
        this.bot = botClient;
    }
    
    async handleCommand(userId, command, args) {
        // Check if user is admin
        if (!TohidUtils.isAdmin(userId)) {
            return await this.bot.sendMessage(userId, {
                text: '❌ You are not authorized to use admin commands!'
            });
        }
        
        switch(command) {
            case 'enablebot':
                return await this.enableBot(args[0]);
            case 'disablebot':
                return await this.disableBot(args[0]);
            case 'maintenance':
                return await this.setMaintenance(args[0]);
            case 'adminstats':
                return await this.getAdminStats();
            case 'resetlimits':
                return await this.resetLimits(args[0]);
            case 'broadcast':
                return await this.broadcastMessage(args.join(' '));
            case 'listusers':
                return await this.listUsers();
            case 'blockuser':
                return await this.blockUser(args[0]);
            case 'unblockuser':
                return await this.unblockUser(args[0]);
            case 'addgroup':
                return await this.addGroup(args[0], args[1], userId);
            case 'removegroup':
                return await this.removeGroup(args[0]);
            case 'clearcache':
                return await this.clearCache();
            case 'helpadmin':
                return await this.helpAdmin(userId);
            default:
                return await this.bot.sendMessage(userId, {
                    text: '❌ Unknown admin command. Use !helpadmin to see available commands.'
                });
        }
    }
    
    async enableBot(groupId) {
        try {
            if (!groupId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !enablebot <groupId>\nExample: !enablebot 123456789@g.us'
                });
            }
            
            await Group.findOneAndUpdate(
                { groupId },
                { 
                    botEnabled: true,
                    isEnabled: true,
                    lastActivity: new Date()
                },
                { upsert: true, new: true }
            );
            
            return await this.bot.sendMessage(userId, {
                text: `✅ Bot enabled for group: ${groupId}`
            });
            
        } catch (error) {
            console.error('Enable Bot Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to enable bot'
            });
        }
    }
    
    async disableBot(groupId) {
        try {
            if (!groupId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !disablebot <groupId>\nExample: !disablebot 123456789@g.us'
                });
            }
            
            await Group.findOneAndUpdate(
                { groupId },
                { 
                    botEnabled: false,
                    lastActivity: new Date()
                },
                { upsert: true }
            );
            
            return await this.bot.sendMessage(userId, {
                text: `✅ Bot disabled for group: ${groupId}`
            });
            
        } catch (error) {
            console.error('Disable Bot Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to disable bot'
            });
        }
    }
    
    async setMaintenance(mode) {
        try {
            const validModes = ['on', 'off', 'true', 'false'];
            if (!validModes.includes(mode?.toLowerCase())) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !maintenance <on/off>\nExample: !maintenance on'
                });
            }
            
            const isMaintenance = ['on', 'true'].includes(mode.toLowerCase());
            
            // Update cache
            TohidCache.setTempData('maintenance_mode', isMaintenance, 86400);
            
            return await this.bot.sendMessage(userId, {
                text: `✅ Maintenance mode ${isMaintenance ? 'ENABLED' : 'DISABLED'}`
            });
            
        } catch (error) {
            console.error('Maintenance Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to set maintenance mode'
            });
        }
    }
    
    async getAdminStats() {
        try {
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({
                lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });
            const totalGroups = await Group.countDocuments();
            const activeGroups = await Group.countDocuments({
                lastActivity: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });
            const activeQuizzes = await QuizSession.countDocuments({ isActive: true });
            const totalQuizzes = await QuizSession.countDocuments();
            const pendingChallenges = await Challenge.countDocuments({ status: 'pending' });
            const totalChallenges = await Challenge.countDocuments();
            const blockedUsers = await User.countDocuments({ isBlocked: true });
            
            const cacheStats = TohidCache.getStatsInfo();
            
            const statsText = `📊 *Admin Statistics - ${config.BOT_NAME}*\n\n` +
                `👥 *Users:*\n` +
                `• Total: ${TohidUtils.formatNumber(totalUsers)}\n` +
                `• Active (7 days): ${TohidUtils.formatNumber(activeUsers)}\n` +
                `• Blocked: ${blockedUsers}\n\n` +
                `👥 *Groups:*\n` +
                `• Total: ${TohidUtils.formatNumber(totalGroups)}\n` +
                `• Active (7 days): ${TohidUtils.formatNumber(activeGroups)}\n\n` +
                `🎮 *Quizzes:*\n` +
                `• Active: ${activeQuizzes}\n` +
                `• Total: ${TohidUtils.formatNumber(totalQuizzes)}\n\n` +
                `⚔️ *Challenges:*\n` +
                `• Pending: ${pendingChallenges}\n` +
                `• Total: ${TohidUtils.formatNumber(totalChallenges)}\n\n` +
                `💾 *Cache:*\n` +
                `• Keys: ${cacheStats.keys}\n` +
                `• Hits: ${cacheStats.hits}\n` +
                `• Misses: ${cacheStats.misses}\n\n` +
                `👑 *Owner:* ${config.OWNER_NAME}\n` +
                `📞 *Contact:* ${config.OWNER_NUMBER}\n` +
                `🕒 *Last Updated:* ${new Date().toLocaleString()}`;
            
            return await this.bot.sendMessage(userId, { text: statsText });
            
        } catch (error) {
            console.error('Admin Stats Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to get admin statistics'
            });
        }
    }
    
    async resetLimits(targetUserId) {
        try {
            if (!targetUserId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !resetlimits <userId>\nExample: !resetlimits 918765432100@s.whatsapp.net'
                });
            }
            
            await User.findOneAndUpdate(
                { userId: targetUserId },
                { 
                    dailyUsed: 0,
                    lastActive: new Date()
                }
            );
            
            return await this.bot.sendMessage(userId, {
                text: `✅ Daily limits reset for user: ${targetUserId}`
            });
            
        } catch (error) {
            console.error('Reset Limits Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to reset limits'
            });
        }
    }
    
    async broadcastMessage(message) {
        try {
            if (!message || message.trim().length < 5) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !broadcast <message>\nMessage must be at least 5 characters.'
                });
            }
            
            const users = await User.find({ isBlocked: false });
            const groups = await Group.find({ botEnabled: true });
            
            let sentCount = 0;
            let failedCount = 0;
            
            const broadcastText = `📢 *Broadcast from ${config.BOT_NAME}*\n\n${message}\n\n_This is an automated broadcast message._`;
            
            // Send to users
            for (const user of users) {
                try {
                    await this.bot.sendMessage(user.userId, { text: broadcastText });
                    sentCount++;
                    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
                } catch (error) {
                    console.error(`Failed to send to user ${user.userId}:`, error);
                    failedCount++;
                }
            }
            
            // Send to groups
            for (const group of groups) {
                try {
                    await this.bot.sendMessage(group.groupId, { text: broadcastText });
                    sentCount++;
                    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
                } catch (error) {
                    console.error(`Failed to send to group ${group.groupId}:`, error);
                    failedCount++;
                }
            }
            
            const resultText = `✅ *Broadcast Completed!*\n\n` +
                `📤 Sent to: ${sentCount} recipients\n` +
                `❌ Failed: ${failedCount}\n` +
                `📝 Message length: ${message.length} characters\n` +
                `🕒 Time: ${new Date().toLocaleString()}`;
            
            return await this.bot.sendMessage(userId, { text: resultText });
            
        } catch (error) {
            console.error('Broadcast Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to broadcast message'
            });
        }
    }
    
    async listUsers(limit = 20) {
        try {
            const users = await User.find()
                .sort({ points: -1 })
                .limit(limit);
            
            let userList = `👥 *Top ${limit} Users*\n\n`;
            
            users.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : 
                             index === 1 ? '🥈' : 
                             index === 2 ? '🥉' : `${index + 1}.`;
                
                userList += `${medal} *${user.name}*\n`;
                userList += `   📞 ${user.phone || 'N/A'}\n`;
                userList += `   🏆 ${TohidUtils.formatNumber(user.points)} points | ${user.rank}\n`;
                userList += `   🎮 Quizzes: ${user.totalQuizzes}\n`;
                userList += `   ⚔️ Challenges: ${user.totalChallenges}\n`;
                userList += `   🚫 ${user.isBlocked ? 'Blocked' : 'Active'}\n`;
                userList += `   👑 ${user.isAdmin ? 'Admin' : 'User'}\n\n`;
            });
            
            const totalUsers = await User.countDocuments();
            userList += `📊 Total Users: ${TohidUtils.formatNumber(totalUsers)}`;
            
            return await this.bot.sendMessage(userId, { text: userList });
            
        } catch (error) {
            console.error('List Users Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to list users'
            });
        }
    }
    
    async blockUser(targetUserId) {
        try {
            if (!targetUserId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !blockuser <userId>\nExample: !blockuser 918765432100@s.whatsapp.net'
                });
            }
            
            // Prevent blocking admins
            const targetUser = await User.findOne({ userId: targetUserId });
            if (targetUser?.isAdmin) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Cannot block another admin!'
                });
            }
            
            await User.findOneAndUpdate(
                { userId: targetUserId },
                { isBlocked: true },
                { upsert: true }
            );
            
            return await this.bot.sendMessage(userId, {
                text: `✅ User blocked: ${targetUserId}`
            });
            
        } catch (error) {
            console.error('Block User Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to block user'
            });
        }
    }
    
    async unblockUser(targetUserId) {
        try {
            if (!targetUserId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !unblockuser <userId>\nExample: !unblockuser 918765432100@s.whatsapp.net'
                });
            }
            
            await User.findOneAndUpdate(
                { userId: targetUserId },
                { isBlocked: false }
            );
            
            return await this.bot.sendMessage(userId, {
                text: `✅ User unblocked: ${targetUserId}`
            });
            
        } catch (error) {
            console.error('Unblock User Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to unblock user'
            });
        }
    }
    
    async addGroup(groupId, groupName, addedBy) {
        try {
            if (!groupId || !groupName) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !addgroup <groupId> <groupName>\nExample: !addgroup 123456789@g.us "Quiz Group"'
                });
            }
            
            await Group.findOneAndUpdate(
                { groupId },
                {
                    groupName,
                    isEnabled: true,
                    botEnabled: true,
                    addedBy,
                    addedAt: new Date(),
                    lastActivity: new Date()
                },
                { upsert: true, new: true }
            );
            
            return await this.bot.sendMessage(userId, {
                text: `✅ Group added: ${groupName}\nID: ${groupId}`
            });
            
        } catch (error) {
            console.error('Add Group Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to add group'
            });
        }
    }
    
    async removeGroup(groupId) {
        try {
            if (!groupId) {
                return await this.bot.sendMessage(userId, {
                    text: '❌ Usage: !removegroup <groupId>\nExample: !removegroup 123456789@g.us'
                });
            }
            
            await Group.findOneAndDelete({ groupId });
            
            return await this.bot.sendMessage(userId, {
                text: `✅ Group removed: ${groupId}`
            });
            
        } catch (error) {
            console.error('Remove Group Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to remove group'
            });
        }
    }
    
    async clearCache() {
        try {
            TohidCache.clearAll();
            
            return await this.bot.sendMessage(userId, {
                text: '✅ Cache cleared successfully!'
            });
            
        } catch (error) {
            console.error('Clear Cache Error:', error);
            return await this.bot.sendMessage(userId, {
                text: '❌ Failed to clear cache'
            });
        }
    }
    
    async helpAdmin(userId) {
        const helpText = `🛠️ *Admin Commands - ${config.BOT_NAME}*\n\n` +
            `*Bot Management:*\n` +
            `• !enablebot <groupId> - Enable bot in group\n` +
            `• !disablebot <groupId> - Disable bot in group\n` +
            `• !maintenance <on/off> - Set maintenance mode\n` +
            `• !clearcache - Clear bot cache\n\n` +
            `*User Management:*\n` +
            `• !blockuser <userId> - Block a user\n` +
            `• !unblockuser <userId> - Unblock a user\n` +
            `• !resetlimits <userId> - Reset user limits\n` +
            `• !listusers - List all users\n\n` +
            `*Group Management:*\n` +
            `• !addgroup <groupId> <name> - Add group\n` +
            `• !removegroup <groupId> - Remove group\n\n` +
            `*Information:*\n` +
            `• !adminstats - Show bot statistics\n` +
            `• !broadcast <message> - Broadcast message\n\n` +
            `👑 *Owner:* ${config.OWNER_NAME}\n` +
            `📞 *Contact:* ${config.OWNER_NUMBER}`;
        
        return await this.bot.sendMessage(userId, { text: helpText });
    }
}

module.exports = AdminCommands;