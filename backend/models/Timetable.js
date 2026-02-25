// const mongoose = require('mongoose');

// const TimeSlotSchema = new mongoose.Schema({
//     day: {
//         type: String,
//         enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
//         required: true
//     },
//     startTime: {
//         type: String,
//         required: true
//     },
//     endTime: {
//         type: String,
//         required: true
//     },
//     subject: {
//         type: String,
//         required: true
//     },
//     faculty: {
//         type: String
//     },
//     batch: {
//         type: String
//     }
// });

// const TimetableSchema = new mongoose.Schema({
//     room: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Room',
//         required: true
//     },
//     slots: [TimeSlotSchema],
//     semester: {
//         type: String,
//         required: true
//     },
//     academicYear: {
//         type: String,
//         required: true
//     },
//     isActive: {
//         type: Boolean,
//         default: true
//     }
// }, {
//     timestamps: true
// });

// module.exports = mongoose.model('Timetable', TimetableSchema);

const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
    },
    startTime: {
        type: String,  // Format: "09:00", "14:30"
        required: true,
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: props => `${props.value} is not a valid time format (HH:MM)!`
        }
    },
    endTime: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: props => `${props.value} is not a valid time format (HH:MM)!`
        }
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    subjectCode: {
        type: String,
        trim: true
    },
    faculty: {
        type: String,
        required: true,
        trim: true
    },
    facultyId: {
        type: String,
        trim: true
    },
    batch: {
        type: String,
        required: true
    },
    section: {
        type: String,
        trim: true
    },
    semester: {
        type: String,
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    courseType: {
        type: String,
        enum: ['Lecture', 'Lab', 'Tutorial', 'Project', 'Seminar', 'Other'],
        default: 'Lecture'
    },
    isRecurring: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    exceptions: [{
        date: Date,
        reason: String,
        status: {
            type: String,
            enum: ['cancelled', 'rescheduled', 'room_changed']
        },
        newRoom: String,
        newTime: String
    }],
    roomOverride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    },
    status: {
        type: String,
        enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
        default: 'scheduled'
    }
});

const TimetableSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
        index: true
    },
    slots: [TimeSlotSchema],
    
    // Timetable metadata
    timetableName: {
        type: String,
        trim: true
    },
    department: {
        type: String,
        required: true
    },
    program: {
        type: String,
        trim: true
    },
    semester: {
        type: String,
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    
    // Schedule validity
    validFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    validUntil: {
        type: Date
    },
    
    // Status tracking
    isActive: {
        type: Boolean,
        default: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // For quick querying
    daySlots: {
        Monday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
        Tuesday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
        Wednesday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
        Thursday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
        Friday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
        Saturday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
        Sunday: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }]
    }
}, {
    timestamps: true
});

// Create indexes for faster queries
TimetableSchema.index({ room: 1, isActive: 1 });
TimetableSchema.index({ 'slots.day': 1, 'slots.startTime': 1, 'slots.endTime': 1 });
TimetableSchema.index({ department: 1, semester: 1, academicYear: 1 });

// Pre-save middleware to organize slots by day
TimetableSchema.pre('save', function(next) {
    if (this.isModified('slots')) {
        this.daySlots = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };
        
        this.slots.forEach((slot, index) => {
            if (this.daySlots[slot.day]) {
                this.daySlots[slot.day].push(slot._id);
            }
        });
    }
    next();
});

module.exports = mongoose.model('Timetable', TimetableSchema);