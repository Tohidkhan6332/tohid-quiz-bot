const mongoose = require('mongoose');
const TohidDatabase = require('./Tohidmongo');

// User Schema
const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String },
    points: { type: Number, default: 0, index: true },
    totalQuizzes: { type: Number, default: 0 },
    quizzesWon: { type: Number, default: 0 },
    totalChallenges: { type: Number, default: 0 },
    challengesWon: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    totalAnswers: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    rank: { type: String, default: 'Beginner' },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    dailyLimit: { type: Number, default: 10 },
    dailyUsed: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Calculate accuracy
    if (this.totalAnswers > 0) {
        this.accuracy = Math.round((this.correctAnswers / this.totalAnswers) * 100);
    }
    
    // Calculate level based on points
    this.level = Math.floor(this.points / 100) + 1;
    next();
});

// Quiz Session Schema
const QuizSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    groupId: { type: String, required: true, index: true },
    category: { type: String, required: true },
    difficulty: { type: String, default: 'medium' },
    numQuestions: { type: Number, default: 10 },
    questions: [{
        question: String,
        options: [String],
        correctAnswer: String,
        points: Number,
        timeLimit: Number
    }],
    currentQuestion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    startedBy: { type: String, required: true },
    participants: [{
        userId: String,
        name: String,
        score: { type: Number, default: 0 },
        answers: [{
            questionIndex: Number,
            answer: String,
            isCorrect: Boolean,
            pointsEarned: Number,
            timeTaken: Number,
            answeredAt: Date
        }],
        joinedAt: { type: Date, default: Date.now }
    }],
    leaderboard: [{
        userId: String,
        name: String,
        score: Number,
        position: Number
    }],
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date },
    winner: {
        userId: String,
        name: String,
        score: Number
    }
}, { timestamps: true });

// Challenge Schema
const ChallengeSchema = new mongoose.Schema({
    challengeId: { type: String, required: true, unique: true, index: true },
    challengerId: { type: String, required: true, index: true },
    challengerName: { type: String, required: true },
    opponentId: { type: String, required: true, index: true },
    opponentName: { type: String, required: true },
    category: { type: String, required: true },
    difficulty: { type: String, default: 'medium' },
    numQuestions: { type: Number, default: 5 },
    questions: [{
        question: String,
        options: [String],
        correctAnswer: String,
        points: Number
    }],
    challengerAnswers: [{
        questionIndex: Number,
        answer: String,
        isCorrect: Boolean,
        pointsEarned: Number,
        answeredAt: Date
    }],
    opponentAnswers: [{
        questionIndex: Number,
        answer: String,
        isCorrect: Boolean,
        pointsEarned: Number,
        answeredAt: Date
    }],
    challengerScore: { type: Number, default: 0 },
    opponentScore: { type: Number, default: 0 },
    winnerId: String,
    winnerName: String,
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'in_progress', 'completed', 'declined', 'expired'],
        default: 'pending',
        index: true
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    expiresAt: { type: Date, index: true }
}, { timestamps: true });

// Group Schema
const GroupSchema = new mongoose.Schema({
    groupId: { type: String, required: true, unique: true, index: true },
    groupName: { type: String, required: true },
    isEnabled: { type: Boolean, default: true, index: true },
    botEnabled: { type: Boolean, default: true },
    adminOnly: { type: Boolean, default: false },
    activeQuiz: { type: String, default: null },
    activeChallenge: { type: String, default: null },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    settings: {
        maxQuestions: { type: Number, default: 10 },
        questionTimeout: { type: Number, default: 30000 },
        allowChallenges: { type: Boolean, default: true },
        autoStart: { type: Boolean, default: false }
    },
    stats: {
        totalQuizzes: { type: Number, default: 0 },
        totalParticipants: { type: Number, default: 0 },
        lastQuizAt: { type: Date }
    }
}, { timestamps: true });

// User Stats Schema (for daily/weekly/monthly tracking)
const UserStatsSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    pointsEarned: { type: Number, default: 0 },
    quizzesPlayed: { type: Number, default: 0 },
    challengesPlayed: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    totalAnswers: { type: Number, default: 0 },
    rank: { type: Number, default: 0 }
}, { timestamps: true });

// Quiz History Schema
const QuizHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    type: { type: String, enum: ['group', 'challenge'], required: true },
    category: { type: String, required: true },
    difficulty: { type: String, required: true },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, default: 0 },
    position: { type: Number },
    opponentId: { type: String },
    opponentName: { type: String },
    opponentScore: { type: Number },
    playedAt: { type: Date, default: Date.now, index: true },
    duration: { type: Number } // in seconds
}, { timestamps: true });

// Create indexes
UserSchema.index({ points: -1 });
UserSchema.index({ level: -1 });
QuizSessionSchema.index({ endedAt: -1 });
ChallengeSchema.index({ completedAt: -1 });
GroupSchema.index({ lastActivity: -1 });
UserStatsSchema.index({ userId: 1, date: -1 });
QuizHistorySchema.index({ userId: 1, playedAt: -1 });

// Create models
const User = mongoose.model('User', UserSchema);
const QuizSession = mongoose.model('QuizSession', QuizSessionSchema);
const Challenge = mongoose.model('Challenge', ChallengeSchema);
const Group = mongoose.model('Group', GroupSchema);
const UserStats = mongoose.model('UserStats', UserStatsSchema);
const QuizHistory = mongoose.model('QuizHistory', QuizHistorySchema);

module.exports = {
    User,
    QuizSession,
    Challenge,
    Group,
    UserStats,
    QuizHistory,
    connection: TohidDatabase
};