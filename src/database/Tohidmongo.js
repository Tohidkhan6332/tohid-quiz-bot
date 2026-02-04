const mongoose = require('mongoose');
const config = require('../config');

class TohidDatabase {
    constructor() {
        this.isConnected = false;
        this.connect();
    }
    
    async connect() {
        try {
            if (!config.MONGODB_URL) {
                throw new Error('MONGODB_URL is not defined in environment variables');
            }
            
            await mongoose.connect(config.MONGODB_URL, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            
            this.isConnected = true;
            console.log('✅ MongoDB Connected Successfully - Tohid Quiz Bot');
            
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB Connection Error:', err);
                this.isConnected = false;
            });
            
            mongoose.connection.on('disconnected', () => {
                console.log('⚠️ MongoDB Disconnected');
                this.isConnected = false;
            });
            
            process.on('SIGINT', async () => {
                await mongoose.connection.close();
                console.log('👋 MongoDB Connection Closed');
                process.exit(0);
            });
            
        } catch (error) {
            console.error('❌ MongoDB Connection Failed:', error.message);
            console.log('🔄 Retrying connection in 5 seconds...');
            setTimeout(() => this.connect(), 5000);
        }
    }
    
    async isReady() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }
    
    async disconnect() {
        if (this.isConnected) {
            await mongoose.connection.close();
            this.isConnected = false;
            console.log('👋 MongoDB Disconnected');
        }
    }
    
    async healthCheck() {
        try {
            await mongoose.connection.db.admin().ping();
            return { status: 'healthy', timestamp: new Date() };
        } catch (error) {
            return { status: 'unhealthy', error: error.message, timestamp: new Date() };
        }
    }
    
    async getStats() {
        if (!this.isConnected) return null;
        
        try {
            const db = mongoose.connection.db;
            const stats = await db.stats();
            return {
                database: stats.db,
                collections: stats.collections,
                objects: stats.objects,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexSize: stats.indexSize
            };
        } catch (error) {
            console.error('Database Stats Error:', error);
            return null;
        }
    }
}

module.exports = new TohidDatabase();