const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: true
    },
    clientNumber: {
        type: String,
        required: true
    },
    stationLocation: {
        type: String,
        required: true,
        enum: ['NYS GILGI', 'NYS NAIVASHA', 'MARRIEDQUARTERS', '5KRMAIN CAMP'],
        message: 'Please select a valid station'
    },
    houseNumber: {
        type: String,
        required: true
    },
    problemDescription: {
        type: String,
        required: true
    },
    problemCorrected: {
        type: String,
        required: function() {
            return this.status === 'Resolved';
        }
    },
    reportedDateTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved'],
        default: 'Open'
    },
    category: {
        type: String,
        enum: ['Installation', 'LOS', 'Other'],
        required: true
    },
    followUpSent: {
        type: Boolean,
        default: false
    },
    lastFollowUpSent: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Ticket', ticketSchema); 