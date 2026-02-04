require('dotenv').config();

module.exports = {
    // Bot Identity
    BOT_NAME: process.env.BOT_NAME || "Tohid-Quiz",
    OWNER_NAME: process.env.OWNER_NAME || "Mr Tohid",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "+917849917350",
    BOT_ADMINS: process.env.BOT_ADMINS ? process.env.BOT_ADMINS.split(',') : [],
    
    // URLs
    WHATSAPP_GROUP: process.env.WHATSAPP_GROUP || "https://chat.whatsapp.com/HUEyTVIQ7Ij1gFs6aZkbMk",
    WHATSAPP_CHANNEL: process.env.WHATSAPP_CHANNEL || "https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T",
    QUIZ_WEB: process.env.QUIZ_WEB || "https://tohidgame.vercel.app",
    
    // Database
    MONGODB_URL: process.env.MONGODB_URL,
    
    // Settings
    MAINTENANCE_MODE: process.env.MAINTAINCE_MODE === 'true',
    MAX_QUESTIONS: parseInt(process.env.MAX_QUESTIONS) || 20,
    QUESTION_TIMEOUT: parseInt(process.env.QUESTION_TIMEOUT) || 30000,
    CHALLENGE_TIMEOUT: parseInt(process.env.CHALLENGE_TIMEOUT) || 120000,
    CACHE_TTL: parseInt(process.env.CACHE_TTL) || 3600,
    
    // API
    TRIVIA_API: "https://opentdb.com/api.php",
    
    // Categories Mapping
    CATEGORIES: {
        'science': { id: 17, icon: '🔬', name: 'Science' },
        'history': { id: 23, icon: '📚', name: 'History' },
        'geography': { id: 22, icon: '🌍', name: 'Geography' },
        'sports': { id: 21, icon: '⚽', name: 'Sports' },
        'movies': { id: 11, icon: '🎬', name: 'Movies' },
        'music': { id: 12, icon: '🎵', name: 'Music' },
        'literature': { id: 10, icon: '📖', name: 'Literature' },
        'art': { id: 25, icon: '🎨', name: 'Art' },
        'technology': { id: 18, icon: '💻', name: 'Technology' },
        'animals': { id: 27, icon: '🦁', name: 'Animals' },
        'space': { id: 17, icon: '🚀', name: 'Space' },
        'food': { id: 9, icon: '🍕', name: 'Food' },
        'psychology': { id: 21, icon: '🧠', name: 'Psychology' }
    },
    
    // Difficulties
    DIFFICULTIES: {
        'easy': { name: 'Easy', points: 10 },
        'medium': { name: 'Medium', points: 15 },
        'hard': { name: 'Hard', points: 20 }
    },
    
    // Ranks
    RANKS: [
        { name: 'Beginner', min: 0, max: 100 },
        { name: 'Learner', min: 101, max: 500 },
        { name: 'Scholar', min: 501, max: 1000 },
        { name: 'Expert', min: 1001, max: 2000 },
        { name: 'Master', min: 2001, max: 5000 },
        { name: 'Legend', min: 5001, max: Infinity }
    ]
};