const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const { sendSMS } = require('./sms');

// Helper to get next send date
function getNextSendDate(reminder) {
    const now = new Date();
    let next;
    
    // For repeating reminders, use lastSent as base if available, otherwise use schedule
    const baseDate = reminder.lastSent || new Date(reminder.schedule);
    
    switch (reminder.frequency) {
        case 'weekly':
            // Calculate next occurrence on the same day of week
            next = new Date(baseDate);
            // Add 7 days to get to next week
            next.setDate(next.getDate() + 7);
            // Ensure we're not scheduling in the past
            if (next <= now) {
                next.setDate(next.getDate() + 7);
            }
            break;
            
        case 'monthly':
            // Calculate next occurrence on the same day of month
            next = new Date(baseDate);
            // Add one month
            next.setMonth(next.getMonth() + 1);
            // Handle edge case where target month has fewer days
            if (next.getDate() !== baseDate.getDate()) {
                next.setDate(0); // Last day of previous month
            }
            // Ensure we're not scheduling in the past
            if (next <= now) {
                next.setMonth(next.getMonth() + 1);
                if (next.getDate() !== baseDate.getDate()) {
                    next.setDate(0);
                }
            }
            break;
            
        case 'repeat':
            // For custom repeat interval
            next = new Date(baseDate);
            const interval = reminder.repeatInterval || 1;
            next.setDate(next.getDate() + interval);
            // Ensure we're not scheduling in the past
            while (next <= now) {
                next.setDate(next.getDate() + interval);
            }
            break;
            
        default:
            next = null;
    }
    
    // If we somehow got a null or invalid date, return null
    if (!next || isNaN(next.getTime())) {
        return null;
    }
    
    // Preserve the original time from the schedule
    const originalTime = new Date(reminder.schedule);
    next.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
    
    return next;
}

async function processReminders() {
    const now = new Date();
    console.log('\n=== Starting Reminder Check ===');
    console.log(`Current time: ${now.toISOString()}`);
    
    // Find all scheduled reminders, including late ones
    const reminders = await Reminder.find({ 
        status: { $in: ['Scheduled'] },
        schedule: { $exists: true }
    });
    
    console.log(`Found ${reminders.length} scheduled reminders`);
    
    // Get default numbers directly from environment variable
    const defaultNumbers = process.env.R_NUMBERS ? [process.env.R_NUMBERS] : [];
    console.log(`Using default number from R_NUMBERS: ${defaultNumbers[0]}`);
    
    for (const reminder of reminders) {
        console.log(`\nAnalyzing reminder "${reminder.name}" (${reminder._id}):`);
        console.log(`- Scheduled for: ${reminder.schedule.toISOString()}`);
        console.log(`- Current time: ${now.toISOString()}`);
        console.log(`- Status: ${reminder.status}`);
        console.log(`- Frequency: ${reminder.frequency}`);
        
        // Check if reminder is due (including late ones)
        if (reminder.schedule && reminder.schedule <= now) {
            console.log('- Reminder is due (including late)');
            let allSent = true;
            
            // Always use the number from R_NUMBERS
            const numberToSend = defaultNumbers[0];
            
            if (!numberToSend) {
                console.error(`- ERROR: No phone number configured in R_NUMBERS`);
                reminder.status = 'Failed';
                await reminder.save();
                continue;
            }
            
            console.log(`- Sending to number: ${numberToSend}`);
            
            try {
                // Format the message based on whether the reminder is late
                let message;
                const minutesLate = Math.floor((now - reminder.schedule) / (1000 * 60));
                if (minutesLate > 5) {  // Only mark as late if more than 5 minutes late
                    message = `REMINDER LATE\n\nTitle: ${reminder.name}\n\nDescription: ${reminder.description}\n\nOriginal Schedule: ${reminder.schedule.toLocaleString()}\n\nLate by: ${minutesLate} minutes`;
                } else {
                    message = `REMINDER DUE\n\nTitle: ${reminder.name}\n\nDescription: ${reminder.description}\n\nDue: ${reminder.schedule.toLocaleString()}`;
                }

                // Add amount if provided
                if (reminder.amount) {
                    message += `\n\nAmount: KES ${reminder.amount.toLocaleString()}`;
                }

                // Add category if provided
                if (reminder.category) {
                    message += `\n\nCategory: ${reminder.category}`;
                }

                message += '\n\nPlease take necessary action';
                
                console.log(`- Attempting to send SMS to ${numberToSend}`);
                await sendSMS(message, numberToSend);
                console.log(`- Successfully sent reminder to ${numberToSend}${minutesLate > 5 ? ' (LATE)' : ''}`);
            } catch (err) {
                console.error(`- ERROR: Failed to send reminder to ${numberToSend}:`, err);
                allSent = false;
            }
            
            // Update reminder status
            reminder.lastSent = now;
            
            if (reminder.frequency === 'one-time') {
                reminder.status = allSent ? 'Sent' : 'Failed';
                console.log(`- Updated status to: ${reminder.status}`);
            } else {
                // For repeating reminders, always reschedule
                const nextSend = getNextSendDate(reminder);
                if (nextSend) {
                    reminder.schedule = nextSend;
                    reminder.status = 'Scheduled';
                    console.log(`- Rescheduled for next occurrence at: ${nextSend.toISOString()}`);
                } else {
                    reminder.status = allSent ? 'Sent' : 'Failed';
                    console.log(`- Updated status to: ${reminder.status}`);
                }
            }
            
            await reminder.save();
        } else {
            console.log('- Reminder is not due yet');
        }
    }
    
    console.log('\n=== Reminder Check Completed ===\n');
}

// Start the reminder scheduler
function startReminderScheduler() {
    // Run every minute to check for reminders
    cron.schedule('* * * * *', processReminders);
    console.log('Reminder scheduler started');
}

module.exports = {
    startReminderScheduler,
    processReminders
}; 