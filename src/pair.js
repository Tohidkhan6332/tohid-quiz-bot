require('dotenv').config();
const inquirer = require('inquirer');
const chalk = require('chalk');
const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const config = require('./config');

console.log(chalk.blue.bold(`
╔══════════════════════════════════════╗
║        🔐 ${config.BOT_NAME} Pairing      ║
║        👑 ${config.OWNER_NAME}            ║
╚══════════════════════════════════════╝
`));

async function pairBot() {
    try {
        console.log(chalk.cyan('📱 Starting pairing process...\n'));
        
        // Ask for phone number if not in env
        const questions = [];
        
        if (!config.OWNER_NUMBER) {
            questions.push({
                type: 'input',
                name: 'phoneNumber',
                message: 'Enter your WhatsApp number (with country code):',
                validate: (input) => {
                    return input.startsWith('+') && input.length > 10 
                        ? true 
                        : 'Please enter a valid phone number with country code (e.g., +919876543210)';
                }
            });
        }
        
        const answers = await inquirer.prompt(questions);
        const phoneNumber = config.OWNER_NUMBER || answers.phoneNumber;
        
        console.log(chalk.yellow(`\n📞 Using phone number: ${phoneNumber}`));
        
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState('tohid_auth');
        
        // Create socket for pairing
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: state.keys
            },
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, isNewLogin } = update;
            
            if (connection === 'connecting') {
                console.log(chalk.blue('🔄 Connecting to WhatsApp servers...'));
            }
            
            if (connection === 'open') {
                console.log(chalk.green('✅ Connected to WhatsApp!'));
                
                // Get bot info
                const botJid = sock.user?.id;
                const botNumber = botJid?.split('@')[0];
                
                if (botNumber) {
                    console.log(chalk.green(`🤖 Bot Number: ${botNumber}`));
                }
                
                // Send test message
                try {
                    await sock.sendMessage(phoneNumber + '@s.whatsapp.net', {
                        text: `✅ *${config.BOT_NAME} Paired Successfully!*\n\n🤖 Bot is now ready to use!\n🕒 ${new Date().toLocaleString()}`
                    });
                    console.log(chalk.green('📨 Test message sent to owner!'));
                } catch (error) {
                    console.log(chalk.yellow('⚠️ Could not send test message'));
                }
                
                console.log(chalk.green.bold('\n🎉 Pairing completed successfully!'));
                console.log(chalk.cyan('💡 You can now start the bot with: npm start'));
                
                setTimeout(() => {
                    console.log(chalk.blue('\n🔄 Closing pairing session...'));
                    sock.end();
                    process.exit(0);
                }, 3000);
            }
            
            if (connection === 'close') {
                console.log(chalk.red('❌ Connection closed unexpectedly'));
                process.exit(1);
            }
            
            if (isNewLogin) {
                console.log(chalk.yellow('⚠️ New login detected'));
            }
        });
        
        // Request pairing code
        console.log(chalk.cyan('\n🔐 Requesting pairing code...'));
        
        try {
            const code = await sock.requestPairingCode(phoneNumber.replace('+', ''));
            
            console.log(chalk.green.bold('\n══════════════════════════════════════'));
            console.log(chalk.green.bold(`✅ Pairing Code: ${code}`));
            console.log(chalk.green.bold('══════════════════════════════════════\n'));
            
            console.log(chalk.cyan('📋 Instructions:'));
            console.log(chalk.white('1. Open WhatsApp on your phone'));
            console.log(chalk.white('2. Go to Settings → Linked Devices'));
            console.log(chalk.white('3. Tap on "Link a Device"'));
            console.log(chalk.white(`4. Enter this code: ${chalk.green.bold(code)}`));
            console.log(chalk.white('5. Wait for confirmation...\n'));
            
            console.log(chalk.yellow('⏳ Waiting for pairing confirmation...'));
            console.log(chalk.gray('(Press Ctrl+C to cancel)'));
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to get pairing code:'), error.message);
            
            if (error.message.includes('not authorized')) {
                console.log(chalk.yellow('\n💡 Solution:'));
                console.log(chalk.white('1. Make sure the phone number is correct'));
                console.log(chalk.white('2. Ensure WhatsApp is installed on that number'));
                console.log(chalk.white('3. Try again in a few minutes'));
            }
            
            sock.end();
            process.exit(1);
        }
        
        // Handle process termination
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\n\n🛑 Pairing cancelled by user'));
            await sock.end();
            process.exit(0);
        });
        
    } catch (error) {
        console.error(chalk.red('❌ Pairing failed:'), error);
        process.exit(1);
    }
}

// Check if phone number is provided
if (!config.OWNER_NUMBER) {
    console.log(chalk.yellow('⚠️ OWNER_NUMBER not found in .env file'));
    console.log(chalk.cyan('💡 You can add it to .env or enter it now\n'));
}

pairBot();