const Ticket = require('../models/Ticket');
const { sendSMS } = require('./sms');

// Function to check and send follow-up messages
async function checkAndSendFollowUps() {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        console.log('\n=== Starting Follow-up Check ===');
        console.log('Current time:', now.toISOString());
        console.log('24 hours ago:', twentyFourHoursAgo.toISOString());

        // First, find all open tickets
        const openTickets = await Ticket.find({ status: 'Open' });
        console.log('\nTotal open tickets found:', openTickets.length);

        // Then filter for tickets that need follow-up
        const ticketsNeedingFollowUp = openTickets.filter(ticket => {
            const ticketAge = now - new Date(ticket.reportedDateTime);
            const hoursSinceCreation = Math.round(ticketAge / (1000 * 60 * 60));
            
            const lastUpdate = new Date(ticket.updatedAt);
            const hoursSinceUpdate = Math.round((now - lastUpdate) / (1000 * 60 * 60));
            
            const lastFollowUp = ticket.lastFollowUpSent ? new Date(ticket.lastFollowUpSent) : null;
            const hoursSinceLastFollowUp = lastFollowUp ? Math.round((now - lastFollowUp) / (1000 * 60 * 60)) : null;

            console.log(`\nAnalyzing ticket #${ticket._id.toString().slice(-6)}:`);
            console.log('- Hours since creation:', hoursSinceCreation);
            console.log('- Hours since last update:', hoursSinceUpdate);
            console.log('- Hours since last follow-up:', hoursSinceLastFollowUp || 'Never');

            // Conditions for needing follow-up (changed back to 24 hours):
            const needsFollowUp = (
                hoursSinceCreation >= 24 && // Created more than 24 hours ago
                hoursSinceUpdate >= 24 && // Not updated in last 24 hours
                (!lastFollowUp || hoursSinceLastFollowUp >= 24) // Never had follow-up OR last follow-up was more than 24 hours ago
            );

            console.log('- Needs follow-up:', needsFollowUp);
            if (needsFollowUp) {
                console.log('- Reason: Ticket meets 24-hour follow-up criteria');
            } else {
                console.log('- Reason: ' + [
                    hoursSinceCreation < 24 ? 'Ticket too new' : null,
                    hoursSinceUpdate < 24 ? 'Recently updated' : null,
                    lastFollowUp && hoursSinceLastFollowUp < 24 ? 'Recent follow-up exists' : null
                ].filter(Boolean).join(', '));
            }
            return needsFollowUp;
        });

        console.log(`\nFound ${ticketsNeedingFollowUp.length} tickets needing follow-up`);

        // Get support numbers from environment variable
        const supportNumbers = process.env.PHONE_NUMBERS ? process.env.PHONE_NUMBERS.split(',').map(num => num.trim()) : [];
        console.log('Support numbers configured:', supportNumbers);

        if (supportNumbers.length === 0) {
            console.error('ERROR: No support numbers found in environment variables!');
            return;
        }

        for (const ticket of ticketsNeedingFollowUp) {
            // Calculate how long the ticket has been open
            const hoursOpen = Math.round((now - new Date(ticket.reportedDateTime)) / (1000 * 60 * 60));
            
            // Create follow-up message (removed test mode indicator)
            const followUpMessage = `REMINDER: Ticket #${ticket._id.toString().slice(-6)} has been open for ${hoursOpen} hours without updates.\n\nClient: ${ticket.clientName} (${ticket.clientNumber})\nLocation: ${ticket.stationLocation}, House: ${ticket.houseNumber}\nCategory: ${ticket.category}\nProblem: ${ticket.problemDescription}\n\nPlease update the ticket status as soon as possible.`;

            console.log(`\nProcessing follow-up for ticket #${ticket._id.toString().slice(-6)}`);

            // Send follow-up to all support numbers
            for (const supportNumber of supportNumbers) {
                try {
                await sendSMS(followUpMessage, supportNumber);
                    console.log(`✓ Successfully sent reminder to ${supportNumber}`);
                } catch (error) {
                    console.error(`✗ Failed to send reminder to ${supportNumber}:`, error);
                }
            }

            // Update the lastFollowUpSent timestamp
            ticket.lastFollowUpSent = now;
            await ticket.save();
            console.log(`✓ Updated lastFollowUpSent timestamp for ticket #${ticket._id.toString().slice(-6)}`);
        }

        console.log('\n=== Follow-up Check Completed ===\n');
    } catch (error) {
        console.error('ERROR in follow-up service:', error);
    }
}

module.exports = {
    checkAndSendFollowUps
}; 