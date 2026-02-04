const config = require('../config');
const TohidUtils = require('../lib/TohidUtils');
const TohidCache = require('../lib/TohidCache');
const PublicCommands = require('../commands/Tohidpublic');
const AdminCommands = require('../commands/Tohidadmin');
const QuizSessionManager = require('../quiz/quizSession');
const ChallengeManager = require('../quiz/quizChallenge');
const { User, Group } = require('../database/Tohidmodels');

class MessageHandler {
    constructor(botClient) {
        this.bot = botClient;
        this.publicCommands = new PublicCommands(botClient);
        this.adminCommands = new AdminCommands(botClient);
    }
    
    async handle(m, botClient) {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            const messageType = Object.keys(msg.message)[0];
            if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') return;
            
            const text = messageType === 'conversation' 
                ? msg.message.conversation 
                : msg.message.extendedTextMessage?.text || '';
            
            if (!text.startsWith('!')) return;
            
            const sender = msg.key.remoteJid;
            const isGroup = sender.endsWith('@g.us');
            const groupId = isGroup ? sender : null;
            const userId = msg.key.participant || sender;
            
            // Check maintenance mode
            if (TohidCache.getTempData('maintenance_mode') && !TohidUtils.isAdmin(userId)) {
                await botClient.sendMessage(userId, {
                    text: '🔧 *Bot Under Maintenance*\n\nSorry, the bot is currently under maintenance. Please try again later.'
                });
                return;
            }
            
            // Check if user is blocked
            const user = await User.findOne({ userId });
            if (user?.isBlocked && !TohidUtils.isAdmin(userId)) {
                await botClient.sendMessage(userId, {
                    text: '🚫 *You are blocked from using this bot!*\n\nContact admin for assistance.'
                });
                return;
            }
            
            // Parse command
            const [command, ...args] = text.slice(1).split(' ');
            const commandLower = command.toLowerCase();
            
            // Rate limiting
            const rateLimitKey = `ratelimit_${userId}_${commandLower}`;
            if (!TohidCache.setRateLimit(rateLimitKey, 5, 60) && !TohidUtils.isAdmin(userId)) {
                await botClient.sendMessage(userId, {
                    text: '⏰ *Rate Limit Exceeded!*\n\nPlease wait a minute before using this command again.'
                });
                return;
            }
            
            // Handle commands
            if (commandLower.startsWith('admin')) {
                await this.adminCommands.handleCommand(userId, commandLower, args);
            } else {
                await this.publicCommands.handleCommand(userId, commandLower, args, isGroup, groupId);
            }
            
            // Update user last active
            if (user) {
                user.lastActive = new Date();
                await user.save();
            }
            
        } catch (error) {
            console.error('Message Handler Error:', error);
        }
    }
}

module.exports = MessageHandler;