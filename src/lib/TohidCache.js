const NodeCache = require('node-cache');
const config = require('../config');

class TohidCache {
    constructor() {
        this.cache = new NodeCache({ 
            stdTTL: config.CACHE_TTL,
            checkperiod: 600 
        });
    }
    
    // Session Management
    setSession(sessionId, data) {
        return this.cache.set(`session_${sessionId}`, data, 1800); // 30 minutes
    }
    
    getSession(sessionId) {
        return this.cache.get(`session_${sessionId}`);
    }
    
    deleteSession(sessionId) {
        return this.cache.del(`session_${sessionId}`);
    }
    
    // Group Quiz Sessions
    setGroupQuiz(groupId, sessionId) {
        return this.cache.set(`group_quiz_${groupId}`, sessionId, 3600);
    }
    
    getGroupQuiz(groupId) {
        return this.cache.get(`group_quiz_${groupId}`);
    }
    
    deleteGroupQuiz(groupId) {
        return this.cache.del(`group_quiz_${groupId}`);
    }
    
    // Challenge Sessions
    setChallenge(challengeId, data) {
        return this.cache.set(`challenge_${challengeId}`, data, 7200);
    }
    
    getChallenge(challengeId) {
        return this.cache.get(`challenge_${challengeId}`);
    }
    
    deleteChallenge(challengeId) {
        return this.cache.del(`challenge_${challengeId}`);
    }
    
    // User Cooldowns
    setUserCooldown(userId, type) {
        const key = `cooldown_${userId}_${type}`;
        return this.cache.set(key, true, 60); // 1 minute cooldown
    }
    
    hasUserCooldown(userId, type) {
        const key = `cooldown_${userId}_${type}`;
        return this.cache.has(key);
    }
    
    // Rate Limiting
    setRateLimit(key, limit = 5, window = 60) {
        const current = this.cache.get(`ratelimit_${key}`) || 0;
        if (current >= limit) {
            return false;
        }
        this.cache.set(`ratelimit_${key}`, current + 1, window);
        return true;
    }
    
    // Temporary Data Storage
    setTempData(key, data, ttl = 300) {
        return this.cache.set(`temp_${key}`, data, ttl);
    }
    
    getTempData(key) {
        return this.cache.get(`temp_${key}`);
    }
    
    deleteTempData(key) {
        return this.cache.del(`temp_${key}`);
    }
    
    // Stats Cache
    setStats(key, data) {
        return this.cache.set(`stats_${key}`, data, 300); // 5 minutes
    }
    
    getStats(key) {
        return this.cache.get(`stats_${key}`);
    }
    
    // Leaderboard Cache
    setLeaderboard(type, data) {
        return this.cache.set(`leaderboard_${type}`, data, 600); // 10 minutes
    }
    
    getLeaderboard(type) {
        return this.cache.get(`leaderboard_${type}`);
    }
    
    // Clear all cache
    clearAll() {
        return this.cache.flushAll();
    }
    
    // Get cache stats
    getStatsInfo() {
        return this.cache.getStats();
    }
    
    // List all keys
    listKeys() {
        return this.cache.keys();
    }
}

module.exports = new TohidCache();