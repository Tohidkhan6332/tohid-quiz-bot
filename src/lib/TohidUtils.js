const config = require('../config');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: config.CACHE_TTL });

class TohidUtils {
    static formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
    
    static formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    static generateId(prefix = '') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    static getRank(points) {
        for (const rank of config.RANKS) {
            if (points >= rank.min && points <= rank.max) {
                return rank.name;
            }
        }
        return 'Beginner';
    }
    
    static calculatePoints(difficulty, timeTaken) {
        const basePoints = config.DIFFICULTIES[difficulty].points;
        const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 1000));
        return basePoints + timeBonus;
    }
    
    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    static decodeHTML(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&eacute;/g, 'é')
            .replace(/&ouml;/g, 'ö')
            .replace(/&uuml;/g, 'ü')
            .replace(/&auml;/g, 'ä')
            .replace(/&szlig;/g, 'ß');
    }
    
    static formatButtons(buttons) {
        if (!Array.isArray(buttons)) return [];
        
        const formatted = [];
        for (let i = 0; i < buttons.length; i += 3) {
            const row = buttons.slice(i, i + 3).map(btn => ({
                buttonId: btn.id || `btn_${i}`,
                buttonText: { displayText: btn.text || 'Button' },
                type: 1
            }));
            formatted.push({ buttons: row });
        }
        return formatted;
    }
    
    static setCache(key, value, ttl = config.CACHE_TTL) {
        return cache.set(key, value, ttl);
    }
    
    static getCache(key) {
        return cache.get(key);
    }
    
    static deleteCache(key) {
        return cache.del(key);
    }
    
    static clearCache() {
        return cache.flushAll();
    }
    
    static isAdmin(userId) {
        const cleanNumber = userId.replace('@s.whatsapp.net', '');
        return config.BOT_ADMINS.includes(cleanNumber);
    }
    
    static parseMention(text) {
        const mentionRegex = /@(\d+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1] + '@s.whatsapp.net');
        }
        
        return mentions;
    }
    
    static getRandomEmoji() {
        const emojis = ['🎯', '🚀', '⚡', '🔥', '💡', '🌟', '✨', '🎉', '🏆', '🥇'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
}

module.exports = TohidUtils;