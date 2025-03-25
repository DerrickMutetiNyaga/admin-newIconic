const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'juniorstaff', 'staff', 'admin', 'superadmin'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'inactive'],
        default: 'pending'
    },
    lastLogin: {
        type: Date
    },
    recoveryToken: {
        type: String
    },
    recoveryTokenExpiry: {
        type: Date
    },
    recoveryAttempts: {
        count: {
            type: Number,
            default: 0
        },
        lastAttempt: {
            type: Date
        }
    },
    phone: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Generate recovery token
userSchema.methods.generateRecoveryToken = async function() {
    const crypto = require('crypto');
    this.recoveryToken = crypto.randomBytes(32).toString('hex');
    this.recoveryTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour
    await this.save();
    return this.recoveryToken;
};

// Check if recovery attempt is allowed
userSchema.methods.canAttemptRecovery = function() {
    const now = Date.now();
    const lastAttempt = this.recoveryAttempts.lastAttempt || 0;
    const timeSinceLastAttempt = now - lastAttempt;
    
    // Reset attempts if more than 1 hour has passed
    if (timeSinceLastAttempt > 3600000) {
        this.recoveryAttempts.count = 0;
        return true;
    }
    
    // Allow up to 3 attempts per hour
    return this.recoveryAttempts.count < 3;
};

// Increment recovery attempts
userSchema.methods.incrementRecoveryAttempts = async function() {
    this.recoveryAttempts.count += 1;
    this.recoveryAttempts.lastAttempt = Date.now();
    await this.save();
};

module.exports = mongoose.model('User', userSchema); 