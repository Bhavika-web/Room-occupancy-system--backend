const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['student', 'cr', 'admin'],
        default: 'student'
    },
    department: {
        type: String,
        required: true
    },
    batch: {
        type: String,
        required: function() {
            return this.role === 'student' || this.role === 'cr';
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

/**
 * Pre-save middleware to hash passwords.
 * In modern Mongoose, using an async function means you should 
 * not use the 'next' callback.
 */
UserSchema.pre('save', async function() {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return; 
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        // In async hooks, throwing an error is the same as calling next(error)
        throw error;
    }
});

/**
 * Method to check password validity during login
 */
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);