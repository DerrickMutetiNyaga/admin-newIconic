const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
    equipmentName: {
        type: String,
        required: true,
        trim: true
    },
    modelName: {
        type: String,
        required: true,
        trim: true
    },
    macAddress: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    purchaseDate: {
        type: Date,
        required: false
    },
    status: {
        type: String,
        required: true,
        enum: ['In Stock', 'Assigned', 'Under Maintenance'],
        default: 'In Stock'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
equipmentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Normalize MAC address format before saving
equipmentSchema.pre('save', function(next) {
    // Remove any separators and convert to uppercase
    let mac = this.macAddress.replace(/[:-]/g, '').toUpperCase();
    
    // Format with colons
    if (mac.length === 12) {
        this.macAddress = mac.match(/.{1,2}/g).join(':');
    }
    
    next();
});

module.exports = mongoose.model('Equipment', equipmentSchema); 