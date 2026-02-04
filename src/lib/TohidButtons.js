const config = require('../config');

class TohidButtons {
    static getMainMenu() {
        return [
            [
                { buttonId: 'groupquiz', buttonText: { displayText: '🎮 Group Quiz' }, type: 1 },
                { buttonId: 'challenge', buttonText: { displayText: '⚔️ Challenge' }, type: 1 }
            ],
            [
                { buttonId: 'leaderboard', buttonText: { displayText: '🏆 Leaderboard' }, type: 1 },
                { buttonId: 'mystats', buttonText: { displayText: '📊 My Stats' }, type: 1 }
            ],
            [
                { buttonId: 'history', buttonText: { displayText: '📖 History' }, type: 1 },
                { buttonId: 'about', buttonText: { displayText: 'ℹ️ About' }, type: 1 }
            ]
        ];
    }
    
    static getAdminMenu() {
        return [
            [
                { buttonId: 'admin_stats', buttonText: { displayText: '📊 Stats' }, type: 1 },
                { buttonId: 'admin_users', buttonText: { displayText: '👥 Users' }, type: 1 }
            ],
            [
                { buttonId: 'admin_groups', buttonText: { displayText: '👥 Groups' }, type: 1 },
                { buttonId: 'admin_broadcast', buttonText: { displayText: '📢 Broadcast' }, type: 1 }
            ],
            [
                { buttonId: 'admin_block', buttonText: { displayText: '🚫 Block User' }, type: 1 },
                { buttonId: 'admin_maintenance', buttonText: { displayText: '🛠️ Maintenance' }, type: 1 }
            ]
        ];
    }
    
    static getCategoryButtons() {
        const categories = Object.values(config.CATEGORIES);
        const buttons = [];
        
        for (let i = 0; i < categories.length; i += 3) {
            const row = categories.slice(i, i + 3).map(cat => ({
                buttonId: `cat_${cat.name.toLowerCase()}`,
                buttonText: { displayText: `${cat.icon} ${cat.name}` },
                type: 1
            }));
            buttons.push(row);
        }
        
        return buttons;
    }
    
    static getDifficultyButtons() {
        return [
            [
                { buttonId: 'diff_easy', buttonText: { displayText: '😊 Easy' }, type: 1 },
                { buttonId: 'diff_medium', buttonText: { displayText: '😐 Medium' }, type: 1 },
                { buttonId: 'diff_hard', buttonText: { displayText: '😰 Hard' }, type: 1 }
            ]
        ];
    }
    
    static getYesNoButtons() {
        return [
            [
                { buttonId: 'yes', buttonText: { displayText: '✅ Yes' }, type: 1 },
                { buttonId: 'no', buttonText: { displayText: '❌ No' }, type: 1 }
            ]
        ];
    }
    
    static getQuizControlButtons() {
        return [
            [
                { buttonId: 'quiz_stop', buttonText: { displayText: '⏹️ Stop Quiz' }, type: 1 },
                { buttonId: 'quiz_skip', buttonText: { displayText: '⏭️ Skip' }, type: 1 }
            ]
        ];
    }
    
    static getChallengeResponseButtons(challengeId) {
        return [
            [
                { buttonId: `accept_${challengeId}`, buttonText: { displayText: '✅ Accept' }, type: 1 },
                { buttonId: `decline_${challengeId}`, buttonText: { displayText: '❌ Decline' }, type: 1 }
            ]
        ];
    }
    
    static formatQuizOptions(options) {
        const buttons = [];
        
        for (let i = 0; i < options.length; i += 2) {
            const row = [];
            if (options[i]) {
                row.push({
                    buttonId: `ans_${i}`,
                    buttonText: { displayText: `${String.fromCharCode(65 + i)}. ${options[i]}` },
                    type: 1
                });
            }
            if (options[i + 1]) {
                row.push({
                    buttonId: `ans_${i + 1}`,
                    buttonText: { displayText: `${String.fromCharCode(65 + i + 1)}. ${options[i + 1]}` },
                    type: 1
                });
            }
            if (row.length > 0) buttons.push(row);
        }
        
        return buttons;
    }
}

module.exports = TohidButtons;