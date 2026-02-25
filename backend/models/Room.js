const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },
    roomName: {
        type: String,
        required: true
    },
    floor: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    capacity: {
        type: Number,
        required: true
    },
    roomType: {
        type: String,
        enum: ['classroom', 'lab', 'office', 'conference', 'other'],
        default: 'classroom'
    },
    coordinates: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, default: 100 },
        height: { type: Number, default: 80 }
    },
    // Manual status (set by CR/admin)
    status: {
        type: String,
        enum: ['occupied', 'empty', 'maintenance'],
        default: 'empty'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // AUTO STATUS FROM TIMETABLE (NEW FIELDS)
    // Auto-calculated status based on timetable
    autoStatus: {
        type: String,
        enum: ['free', 'occupied', 'ending_soon', 'upcoming_soon', 'unknown'],
        default: 'free'
    },
    
    // Status reason/description
    statusReason: {
        type: String,
        default: 'No timetable data'
    },
    
    // Last automatic update timestamp
    lastAutoUpdate: {
        type: Date,
        default: Date.now
    },
    
    // Next upcoming class information (for quick access)
    nextClass: {
        subject: {
            type: String,
            default: null
        },
        startTime: {
            type: String,
            default: null
        },
        endTime: {
            type: String,
            default: null
        },
        faculty: {
            type: String,
            default: null
        },
        batch: {
            type: String,
            default: null
        }
    },
    
    // Current ongoing class information (for quick access)
    currentClass: {
        subject: {
            type: String,
            default: null
        },
        startTime: {
            type: String,
            default: null
        },
        endTime: {
            type: String,
            default: null
        },
        faculty: {
            type: String,
            default: null
        },
        batch: {
            type: String,
            default: null
        },
        endsIn: {
            type: Number, // minutes until class ends
            default: null
        }
    },
    
    // Final computed status (manual override OR auto status)
    computedStatus: {
        type: String,
        enum: ['occupied', 'empty', 'maintenance', 'free', 'ending_soon', 'upcoming_soon', 'unknown'],
        default: 'free'
    },
    
    // For tracking when to next update status
    nextStatusCheck: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Virtual field to get final status (manual override takes priority)
RoomSchema.virtual('finalStatus').get(function() {
    // If manual status is set (not 'empty'), use it
    if (this.status && this.status !== 'empty') {
        return this.status;
    }
    // Otherwise use auto-calculated status
    return this.autoStatus || 'free';
});

// Method to update status from timetable
RoomSchema.methods.updateFromTimetable = async function(statusData) {
    this.autoStatus = statusData.status;
    this.statusReason = statusData.reason;
    this.lastAutoUpdate = new Date();
    
    if (statusData.currentClass) {
        this.currentClass = {
            subject: statusData.currentClass.subject,
            startTime: statusData.currentClass.startTime,
            endTime: statusData.currentClass.endTime,
            faculty: statusData.currentClass.faculty,
            batch: statusData.currentClass.batch,
            endsIn: this.calculateEndsIn(statusData.currentClass.endTime)
        };
    } else {
        this.currentClass = null;
    }
    
    if (statusData.nextClass) {
        this.nextClass = {
            subject: statusData.nextClass.subject,
            startTime: statusData.nextClass.startTime,
            endTime: statusData.nextClass.endTime,
            faculty: statusData.nextClass.faculty,
            batch: statusData.nextClass.batch
        };
    } else {
        this.nextClass = null;
    }
    
    // Update computed status
    this.computedStatus = (this.status && this.status !== 'empty') ? this.status : this.autoStatus;
    
    // Set next check time (5 minutes from now or when current class ends)
    if (statusData.currentClass) {
        const [hours, minutes] = statusData.currentClass.endTime.split(':');
        const endTime = new Date();
        endTime.setHours(hours, minutes, 0, 0);
        this.nextStatusCheck = endTime;
    } else if (statusData.nextClass) {
        const [hours, minutes] = statusData.nextClass.startTime.split(':');
        const startTime = new Date();
        startTime.setHours(hours, minutes - 15, 0, 0); // Check 15 minutes before next class
        this.nextStatusCheck = startTime;
    } else {
        this.nextStatusCheck = new Date(Date.now() + 30 * 60 * 1000); // Check in 30 minutes
    }
    
    return this.save();
};

// Helper method to calculate minutes until class ends
RoomSchema.methods.calculateEndsIn = function(endTime) {
    const now = new Date();
    const [hours, minutes] = endTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes, 0, 0);
    
    const diffMs = endDate - now;
    const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    
    return diffMinutes;
};

// Indexes for faster queries
RoomSchema.index({ floor: 1, roomNumber: 1 });
RoomSchema.index({ department: 1 });
RoomSchema.index({ computedStatus: 1 });
RoomSchema.index({ nextStatusCheck: 1 });
RoomSchema.index({ autoStatus: 1 });

module.exports = mongoose.model('Room', RoomSchema);