const Ticket = require('../models/Ticket');
const { sendSMS } = require('./sms');

// Function to check and send follow-up messages
async function checkAndSendFollowUps() {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Find tickets that are:
        // 1. In Open status
        // 2. Created more than 24 hours ago
        // 3. Either never had a follow-up (lastFollowUpSent is null)
        //    OR had their last follow-up more than 24 hours ago
        // 4. Not updated in the last 24 hours (still in Open status)
        const ticketsNeedingFollowUp = await Ticket.find({
            status: 'Open',
            reportedDateTime: { $lt: twentyFourHoursAgo },
            updatedAt: { $lt: twentyFourHoursAgo },
            $or: [
                { lastFollowUpSent: null },
                { lastFollowUpSent: { $lt: twentyFourHoursAgo } }
            ]
        });

        console.log(`Found ${ticketsNeedingFollowUp.length} tickets needing follow-up`);

        // Get support numbers from environment variable
        const supportNumbers = process.env.PHONE_NUMBERS.split(',').map(num => num.trim());

        for (const ticket of ticketsNeedingFollowUp) {
            // Calculate how long the ticket has been open
            const hoursOpen = Math.round((now - ticket.reportedDateTime) / (1000 * 60 * 60));
            
            // Create follow-up message with more urgency for older tickets
            const followUpMessage = `REMINDER: Ticket #${ticket._id.toString().slice(-6)} has been open for ${hoursOpen} hours without updates.\n\nClient: ${ticket.clientName} (${ticket.clientNumber})\nLocation: ${ticket.stationLocation}, House: ${ticket.houseNumber}\nCategory: ${ticket.category}\nProblem: ${ticket.problemDescription}\n\nPlease update the ticket status as soon as possible.`;

            // Send follow-up to all support numbers
            for (const supportNumber of supportNumbers) {
                try {
                    await sendSMS(supportNumber, followUpMessage);
                    console.log(`Reminder sent to ${supportNumber} for ticket ${ticket._id}`);
                } catch (error) {
                    console.error(`Failed to send reminder to ${supportNumber} for ticket ${ticket._id}:`, error);
                }
            }

            // Update the lastFollowUpSent timestamp
            ticket.lastFollowUpSent = now;
            await ticket.save();

            console.log(`Follow-up processed for ticket ${ticket._id} (Open for ${hoursOpen} hours)`);
        }

        console.log(`Follow-up check completed. Processed ${ticketsNeedingFollowUp.length} tickets.`);
    } catch (error) {
        console.error('Error in follow-up service:', error);
    }
}

// Export the function to be used in the main application
module.exports = {
    checkAndSendFollowUps
}; 