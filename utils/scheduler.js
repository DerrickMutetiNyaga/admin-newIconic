const cron = require('node-cron');
const { checkAndSendFollowUps } = require('./followUpService');

// Run follow-up check every hour
function startScheduler() {
    // Check for follow-ups every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running follow-up check...');
        await checkAndSendFollowUps();
    });
    
    console.log('Follow-up scheduler started');
}

module.exports = {
    startScheduler
}; 