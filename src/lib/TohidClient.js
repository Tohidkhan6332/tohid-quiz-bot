const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const config = require('../config');
const TohidUtils = require('./TohidUtils');

class TohidClient {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.isPairing = false;
        this.messageHandler = null;
        this.buttonHandler = null;
        this.authFolder = 'tohid_auth';
    }
    
    async connect() {
        console.log(chalk.blue.bold('🔗 Connecting to WhatsApp...'));
        
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
            
            // Fetch latest version
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(chalk.yellow(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`));
            
            this.sock = makeWASocket({
                version,
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: state.keys
                },
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                defaultQueryTimeoutMs: 60 * 1000
            });
            
            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;
                
                if (qr) {
                    console.log(chalk.yellow('⚠️ QR code received (Pairing mode disabled)'));
                    console.log(chalk.red('❌ Please use pairing method instead of QR code'));
                    console.log(chalk.cyan('💡 Run: npm run pair'));
                }
                
                if (connection === 'connecting') {
                    console.log(chalk.blue('🔄 Connecting to WhatsApp...'));
                }
                
                if (connection === 'open') {
                    this.isConnected = true;
                    console.log(chalk.green.bold(`✅ ${config.BOT_NAME} Connected Successfully!`));
                    console.log(chalk.cyan(`👑 Owner: ${config.OWNER_NAME}`));
                    
                    // Get bot info
                    const botJid = this.sock.user?.id;
                    const botNumber = botJid?.split('@')[0];
                    
                    if (botNumber) {
                        console.log(chalk.green(`📱 Bot Number: ${botNumber}`));
                    }
                    
                    // Send connection notification
                    await this.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
                        text: `✅ *${config.BOT_NAME} Started Successfully!*\n\n📱 Bot: ${botNumber || 'Unknown'}\n🕒 ${new Date().toLocaleString()}\n📊 Status: Online & Ready`
                    });
                }
                
                if (connection === 'close') {
                    this.isConnected = false;
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    console.log(chalk.red(`Connection closed: ${lastDisconnect?.error?.message || 'Unknown error'}`));
                    console.log(chalk.yellow(`Reconnecting: ${shouldReconnect}`));
                    
                    if (shouldReconnect) {
                        console.log(chalk.blue('🔄 Reconnecting in 5 seconds...'));
                        setTimeout(() => this.connect(), 5000);
                    }
                }
                
                if (isNewLogin) {
                    console.log(chalk.yellow('⚠️ New login detected!'));
                }
            });
            
            // Save credentials when updated
            this.sock.ev.on('creds.update', saveCreds);
            
            // Handle messages
            this.sock.ev.on('messages.upsert', async (m) => {
                if (this.messageHandler) {
                    await this.messageHandler.handle(m, this);
                }
            });
            
            // Handle callbacks
            this.sock.ev.on('call', (call) => {
                console.log(chalk.yellow('📞 Incoming call from:', call.from));
                // Auto reject calls
                this.sock.rejectCall(call.id, call.from);
            });
            
            // Handle group updates
            this.sock.ev.on('groups.update', (updates) => {
                for (const update of updates) {
                    console.log(chalk.cyan(`👥 Group update: ${update.id} - ${update.subject}`));
                }
            });
            
        } catch (error) {
            console.error(chalk.red('❌ Connection Error:'), error);
            console.log(chalk.yellow('🔄 Retrying in 10 seconds...'));
            setTimeout(() => this.connect(), 10000);
        }
    }
    
    async getGroupMetadata(groupId) {
        try {
            if (!this.sock || !this.isConnected) {
                console.error(chalk.red('❌ Not connected to WhatsApp'));
                return null;
            }
            
            return await this.sock.groupMetadata(groupId);
        } catch (error) {
            console.error(chalk.red('Get Group Metadata Error:'), error);
            return null;
        }
    }
    
    async pairWithCode() {
        console.log(chalk.blue.bold('🔐 Starting pairing process...'));
        
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
            
            // Create pairing socket
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: state.keys
                },
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome')
            });
            
            sock.ev.on('creds.update', saveCreds);
            
            // Handle pairing code
            sock.ev.on('connection.update', async (update) => {
                const { connection, qr, isNewLogin } = update;
                
                if (qr) {
                    console.log(chalk.red('❌ QR code detected in pairing mode'));
                    console.log(chalk.yellow('⚠️ Please restart and use pairing command'));
                    process.exit(1);
                }
                
                if (isNewLogin) {
                    console.log(chalk.green('✅ New login successful!'));
                    await sock.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
                        text: `✅ ${config.BOT_NAME} paired successfully!\n\n🕒 ${new Date().toLocaleString()}`
                    });
                    process.exit(0);
                }
            });
            
            // Start pairing
            const code = await sock.requestPairingCode(config.OWNER_NUMBER.replace('+', ''));
            console.log(chalk.green.bold(`✅ Pairing code: ${code}`));
            console.log(chalk.cyan('💡 Add this number to your WhatsApp linked devices'));
            
            return code;
            
        } catch (error) {
            console.error(chalk.red('❌ Pairing Error:'), error);
            process.exit(1);
        }
    }
    
    async sendMessage(jid, content, options = {}) {
        try {
            if (!this.sock || !this.isConnected) {
                console.error(chalk.red('❌ Not connected to WhatsApp'));
                return null;
            }
            
            return await this.sock.sendMessage(jid, content, options);
        } catch (error) {
            console.error(chalk.red('Send Message Error:'), error);
            return null;
        }
    }
    
    async sendButtons(jid, text, buttons) {
        try {
            const buttonRows = TohidUtils.formatButtons(buttons);
            return await this.sendMessage(jid, {
                text: text,
                footer: config.BOT_NAME,
                buttons: buttonRows,
                headerType: 1
            });
        } catch (error) {
            console.error(chalk.red('Send Buttons Error:'), error);
            return null;
        }
    }
    
    async sendMainMenu(jid, userName = 'User') {
        const buttons = [
            { buttonId: 'groupquiz', buttonText: { displayText: '🎮 Group Quiz' }, type: 1 },
            { buttonId: 'challenge', buttonText: { displayText: '⚔️ Challenge' }, type: 1 },
            { buttonId: 'leaderboard', buttonText: { displayText: '🏆 Leaderboard' }, type: 1 },
            { buttonId: 'mystats', buttonText: { displayText: '📊 My Stats' }, type: 1 },
            { buttonId: 'history', buttonText: { displayText: '📖 History' }, type: 1 },
            { buttonId: 'about', buttonText: { displayText: 'ℹ️ About' }, type: 1 }
        ];
        
        const welcomeText = `🎉 *Welcome ${userName}!* 🤖\n\n*${config.BOT_NAME}* is here to test your knowledge!\n\n📌 Use buttons below to navigate:`;
        
        return await this.sendButtons(jid, welcomeText, buttons);
    }
    
    async sendCategoryMenu(jid, title = '🎯 Select Category:') {
        const categories = Object.values(config.CATEGORIES);
        const buttons = categories.map(cat => ({
            buttonId: `cat_${cat.name.toLowerCase()}`,
            buttonText: { displayText: `${cat.icon} ${cat.name}` },
            type: 1
        }));
        
        const chunkedButtons = [];
        for (let i = 0; i < buttons.length; i += 3) {
            chunkedButtons.push(buttons.slice(i, i + 3));
        }
        
        return await this.sendMessage(jid, {
            text: title,
            footer: config.BOT_NAME,
            buttons: chunkedButtons.map(row => ({ buttons: row })),
            headerType: 1
        });
    }
    
    async sendDifficultyMenu(jid) {
        const buttons = [
            [
                { buttonId: 'diff_easy', buttonText: { displayText: '😊 Easy' }, type: 1 },
                { buttonId: 'diff_medium', buttonText: { displayText: '😐 Medium' }, type: 1 },
                { buttonId: 'diff_hard', buttonText: { displayText: '😰 Hard' }, type: 1 }
            ]
        ];
        
        return await this.sendMessage(jid, {
            text: '📊 Select Difficulty Level:',
            footer: config.BOT_NAME,
            buttons: buttons,
            headerType: 1
        });
    }
    
    async sendQuizQuestion(jid, question, questionNumber, totalQuestions) {
        const options = question.options.map((opt, idx) => ({
            buttonId: `ans_${idx}`,
            buttonText: { displayText: `${String.fromCharCode(65 + idx)}. ${opt}` },
            type: 1
        }));
        
        const chunkedButtons = [];
        for (let i = 0; i < options.length; i += 2) {
            chunkedButtons.push(options.slice(i, i + 2));
        }
        
        const questionText = `❓ *Question ${questionNumber}/${totalQuestions}*\n\n${question.question}\n\n📝 Select your answer:`;
        
        return await this.sendMessage(jid, {
            text: questionText,
            footer: `${config.BOT_NAME} | ⏰ 30 seconds`,
            buttons: chunkedButtons,
            headerType: 1
        });
    }
    
    setMessageHandler(handler) {
        this.messageHandler = handler;
    }
    
    setButtonHandler(handler) {
        this.buttonHandler = handler;
    }
    
    async disconnect() {
        if (this.sock) {
            await this.sock.end();
            this.isConnected = false;
            console.log(chalk.yellow('👋 Disconnected from WhatsApp'));
        }
    }
    
    async getConnectionInfo() {
        if (!this.sock) return null;
        
        return {
            connected: this.isConnected,
            user: this.sock.user,
            phone: this.sock.user?.id?.split('@')[0],
            platform: this.sock.user?.platform,
            pushname: this.sock.user?.name
        };
    }
}

module.exports = TohidClient;