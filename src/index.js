require('dotenv').config();
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const TohidClient = require('./lib/TohidClient');
const MessageHandler = require('./handlers/messageHandler');
const ButtonHandler = require('./handlers/buttonHandler');
const { connection } = require('./database/Tohidmodels');
const config = require('./config');

console.log(chalk.blue.bold(`
╔══════════════════════════════════════╗
║        🚀 ${config.BOT_NAME}          ║
║        👑 ${config.OWNER_NAME}        ║
║        📅 ${new Date().toLocaleDateString()}          ║
╚══════════════════════════════════════╝
`));

// Check if bot is paired
async function checkPaired() {
    const authFolder = 'tohid_auth';
    
    if (!fs.existsSync(authFolder)) {
        console.log(chalk.red('❌ Bot is not paired yet!'));
        console.log(chalk.cyan('💡 Run pairing command: npm run pair'));
        console.log(chalk.yellow('📋 Follow the instructions to pair your device'));
        return false;
    }
    
    const credsFile = path.join(authFolder, 'creds.json');
    if (!fs.existsSync(credsFile)) {
        console.log(chalk.red('❌ Authentication file not found!'));
        console.log(chalk.cyan('💡 Run pairing command: npm run pair'));
        return false;
    }
    
    try {
        const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
        if (!creds.me || !creds.me.id) {
            console.log(chalk.red('❌ Invalid authentication data!'));
            console.log(chalk.cyan('💡 Run pairing command: npm run pair'));
            return false;
        }
        
        console.log(chalk.green('✅ Bot is paired and ready!'));
        console.log(chalk.cyan(`📱 Paired number: ${creds.me.id.split(':')[0]}`));
        return true;
    } catch (error) {
        console.error(chalk.red('❌ Error reading auth data:'), error);
        return false;
    }
}

// Initialize bot
const bot = new TohidClient();

// Initialize handlers
const messageHandler = new MessageHandler(bot);
const buttonHandler = new ButtonHandler(bot);

// Set handlers
bot.setMessageHandler(messageHandler);
bot.setButtonHandler(buttonHandler);

// Start bot
async function startBot() {
    try {
        // Check if bot is paired
        const isPaired = await checkPaired();
        if (!isPaired) {
            console.log(chalk.yellow('\n🔄 Exiting... Please pair the bot first.'));
            process.exit(1);
        }
        
        // Connect to database
        console.log(chalk.blue('🔗 Connecting to database...'));
        await connection.connect();
        console.log(chalk.green('✅ Database connected!'));
        
        // Connect to WhatsApp
        console.log(chalk.blue('📱 Connecting to WhatsApp...'));
        await bot.connect();
        
        console.log(chalk.green.bold('\n✅ Bot initialization complete!'));
        console.log(chalk.cyan('📱 Bot is now running and ready to accept commands...\n'));
        
        // Display bot info
        const botInfo = await bot.getConnectionInfo();
        if (botInfo) {
            console.log(chalk.cyan('🤖 Bot Information:'));
            console.log(chalk.white(`  Phone: ${botInfo.phone || 'Unknown'}`));
            console.log(chalk.white(`  Name: ${botInfo.pushname || 'Unknown'}`));
            console.log(chalk.white(`  Platform: ${botInfo.platform || 'Unknown'}`));
            console.log(chalk.white(`  Status: ${botInfo.connected ? 'Connected ✅' : 'Disconnected ❌'}`));
        }
        
    } catch (error) {
        console.error(chalk.red('❌ Bot startup failed:'), error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n🛑 Shutting down bot...'));
    
    try {
        // Send shutdown notification to owner
        await bot.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
            text: `🛑 *${config.BOT_NAME} Shutting Down*\n\nTime: ${new Date().toLocaleString()}\nReason: Process termination`
        });
        
        // Disconnect from WhatsApp
        await bot.disconnect();
        
        // Disconnect from database
        await connection.disconnect();
        
        console.log(chalk.green('👋 Bot shutdown complete.'));
        process.exit(0);
        
    } catch (error) {
        console.error(chalk.red('Error during shutdown:'), error);
        process.exit(1);
    }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Uncaught Exception:'), error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
});

// Start the bot
startBot();

module.exports = bot;