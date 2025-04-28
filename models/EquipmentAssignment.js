const mongoose = require('mongoose');

const equipmentAssignmentSchema = new mongoose.Schema({
    equipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipment',
        required: true
    },
    assigneeName: {
        type: String,
        required: true
    },
    stationName: {
        type: String,
        required: true
    },
    assignmentType: {
        type: String,
        enum: ['client', 'barrack'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('EquipmentAssignment', equipmentAssignmentSchema); 