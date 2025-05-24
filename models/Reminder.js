const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    numbers: { type: [String], required: true },
    schedule: { type: Date, required: true },
    frequency: { type: String, enum: ['one-time', 'weekly', 'monthly', 'repeat'], default: 'one-time' },
    status: { type: String, enum: ['Scheduled', 'Sent', 'Failed'], default: 'Scheduled' },
    lastSent: { type: Date },
    nextSend: { type: Date },
    repeatInterval: { type: Number }, // in days, for custom repeat
    amount: { type: Number }, // optional amount field
    category: { type: String }, // optional category field
}, { timestamps: true });

module.exports = mongoose.model('Reminder', ReminderSchema); 