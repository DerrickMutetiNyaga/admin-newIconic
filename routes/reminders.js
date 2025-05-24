const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const { sendSMS } = require('../utils/sms');
const User = require('../models/User');

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
};

// Middleware to check if user is admin or superadmin
const requireAdminOrSuperAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await User.findById(req.session.userId);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            return res.status(403).json({ error: 'Not authorized. Admin or Superadmin access required.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Apply admin/superadmin middleware to all routes
router.use(requireAdminOrSuperAdmin);

// Get all reminders
router.get('/', requireAuth, async (req, res) => {
    try {
        const reminders = await Reminder.find().sort({ schedule: 1 });
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reminders' });
    }
});

// Get a single reminder
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const reminder = await Reminder.findById(req.params.id);
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        res.json(reminder);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reminder' });
    }
});

// Create a new reminder
router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, description, numbers, schedule, frequency, repeatInterval, amount, category } = req.body;
        
        // Get the number from R_NUMBERS
        const defaultNumber = process.env.R_NUMBERS;
        if (!defaultNumber) {
            return res.status(400).json({ error: 'No phone number configured in R_NUMBERS' });
        }

        const reminder = new Reminder({
            name,
            description,
            numbers: [defaultNumber],
            schedule: new Date(schedule),
            frequency,
            repeatInterval: frequency === 'repeat' ? repeatInterval : undefined,
            amount: amount ? parseFloat(amount) : undefined,
            category: category || undefined,
            status: 'Scheduled'
        });

        const savedReminder = await reminder.save();

        // Send confirmation SMS when reminder is created
        try {
            const scheduleTime = new Date(schedule).toLocaleString();
            const frequencyText = frequency === 'one-time' ? 'One-time' : 
                                frequency === 'weekly' ? 'Weekly' :
                                frequency === 'monthly' ? 'Monthly' :
                                `Every ${repeatInterval} days`;
            
            let creationMessage = `TICKET CREATED\n\nTitle: ${name}\n\nDescription: ${description}\n\nDue: ${scheduleTime}\n\nFrequency: ${frequencyText}`;
            
            // Add amount if provided
            if (amount) {
                creationMessage += `\n\nAmount: KES ${parseFloat(amount).toLocaleString()}`;
            }
            
            // Add category if provided
            if (category) {
                creationMessage += `\n\nCategory: ${category}`;
            }
            
            creationMessage += '\n\nPlease take necessary action';
            
            await sendSMS(creationMessage, defaultNumber);
            console.log(`Sent creation confirmation SMS for reminder ${savedReminder._id}`);
        } catch (smsError) {
            console.error('Error sending creation confirmation SMS:', smsError);
            // Don't fail the request if SMS fails
        }

        res.status(201).json(savedReminder);
    } catch (error) {
        console.error('Error creating reminder:', error);
        res.status(400).json({ error: 'Failed to create reminder', details: error.message });
    }
});

// Update a reminder
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { name, description, numbers, schedule, frequency, repeatInterval, amount, category } = req.body;
        
        // Get default numbers from environment variable if none provided
        let numbersToUse = numbers;
        if (!numbersToUse || numbersToUse.length === 0) {
            numbersToUse = process.env.R_NUMBERS ? process.env.R_NUMBERS.split(',').map(n => n.trim()) : [];
        }
        
        // Format numbers to ensure they start with +254
        numbersToUse = numbersToUse.map(number => {
            let formatted = number.replace(/\D/g, '');
            if (!formatted.startsWith('254')) {
                formatted = '254' + formatted.replace(/^0+/, '');
            }
            return '+' + formatted;
        });

        const reminder = await Reminder.findById(req.params.id);
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        reminder.name = name;
        reminder.description = description;
        reminder.numbers = numbersToUse;
        reminder.schedule = new Date(schedule);
        reminder.frequency = frequency;
        reminder.repeatInterval = frequency === 'repeat' ? repeatInterval : undefined;
        reminder.amount = amount ? parseFloat(amount) : undefined;
        reminder.category = category || undefined;
        reminder.status = 'Scheduled';

        const updatedReminder = await reminder.save();
        res.json(updatedReminder);
    } catch (error) {
        console.error('Error updating reminder:', error);
        res.status(400).json({ error: 'Failed to update reminder', details: error.message });
    }
});

// Delete a reminder
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const reminder = await Reminder.findByIdAndDelete(req.params.id);
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        res.json({ message: 'Reminder deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});

// Send test SMS
router.post('/send-test', requireAuth, async (req, res) => {
    try {
        const { message, numbers } = req.body;
        const sendTo = numbers && numbers.length ? numbers : process.env.R_NUMBERS.split(',').map(n => n.trim());
        let results = [];
        
        for (const number of sendTo) {
            try {
                // Format the number if needed
                let formattedNumber = number.replace(/\D/g, '');
                if (!formattedNumber.startsWith('254')) {
                    formattedNumber = '254' + formattedNumber.replace(/^0+/, '');
                }
                formattedNumber = '+' + formattedNumber;
                
                await sendSMS(message, formattedNumber);
                results.push({ number: formattedNumber, status: 'Sent' });
            } catch (err) {
                results.push({ number, status: 'Failed', error: err.message });
            }
        }
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send test SMS', details: error.message });
    }
});

module.exports = router; 