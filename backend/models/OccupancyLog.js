const mongoose = require('mongoose');

const OccupancyLogSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    previousStatus: {
        type: String,
        enum: ['occupied', 'empty', 'maintenance']
    },
    newStatus: {
        type: String,
        enum: ['occupied', 'empty', 'maintenance'],
        required: true
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('OccupancyLog', OccupancyLogSchema);