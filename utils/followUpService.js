const Ticket = require('../models/Ticket');
const { sendSMS } = require('./sms');

// Function to check and send follow-up messages
async function checkAndSendFollowUps() {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Find tickets that are:
        // 1. In Open status
        // 2. Either never had a follow-up (lastFollowUpSent is null)
        //    OR had their last follow-up more than 24 hours ago
        const ticketsNeedingFollowUp = await Ticket.find({
            status: 'Open',
            $or: [
                { lastFollowUpSent: null },
                { lastFollowUpSent: { $lt: twentyFourHoursAgo } }
            ]
        });

        // Get support numbers from environment variable
        const supportNumbers = process.env.PHONE_NUMBERS.split(',').map(num => num.trim());

        for (const ticket of ticketsNeedingFollowUp) {
            // Calculate how long the ticket has been open
            const hoursOpen = Math.round((now - ticket.reportedDateTime) / (1000 * 60 * 60));
            
            // Create follow-up message
            const followUpMessage = `Follow-up Alert: Ticket #${ticket._id.toString().slice(-6)} has been open for ${hoursOpen} hours.\n\nClient: ${ticket.clientName} (${ticket.clientNumber})\nLocation: ${ticket.stationLocation}, House: ${ticket.houseNumber}\nCategory: ${ticket.category}\nProblem: ${ticket.problemDescription}`;

            // Send follow-up to all support numbers
            for (const supportNumber of supportNumbers) {
                await sendSMS(followUpMessage, supportNumber);
            }

            // Update the lastFollowUpSent timestamp
            ticket.lastFollowUpSent = now;
            await ticket.save();

            console.log(`Follow-up sent for ticket ${ticket._id}`);
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