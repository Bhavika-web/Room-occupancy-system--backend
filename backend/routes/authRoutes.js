const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT Token
const generateToken = (id) => {
    console.log('🔑 Generating JWT token for user ID:', id);
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_for_development';
    const expire = process.env.JWT_EXPIRE || '7d';
    
    const token = jwt.sign({ id }, secret, {
        expiresIn: expire
    });
    
    console.log('✅ Token generated successfully');
    return token;
};

// Register with detailed logging
router.post('/register', async (req, res) => {
    console.log('\n🔵 ===== REGISTRATION REQUEST =====');
    console.log('📦 Request Body:', req.body);
    console.log('📦 Headers:', req.headers);

    try {
        const { name, email, password, role, department, batch } = req.body;

        // Log received data
        console.log('📝 Received data:', {
            name: name ? '✓' : '✗',
            email: email ? '✓' : '✗',
            password: password ? `[${password.length} chars]` : '✗',
            role: role ? '✓' : '✗',
            department: department ? '✓' : '✗',
            batch: batch ? '✓' : '✗'
        });

        // Validate required fields
        if (!name || !email || !password || !role || !department || !batch) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ 
                success: false,
                message: 'All fields are required',
                received: req.body 
            });
        }

        console.log('🔍 Checking if user exists...');
        const userExists = await User.findOne({ email: email.toLowerCase() });
        
        if (userExists) {
            console.log('❌ User already exists:', email);
            return res.status(400).json({ 
                success: false,
                message: 'User already exists',
                email: email 
            });
        }

        console.log('📝 Creating new user...');
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role,
            department,
            batch
        });

        console.log('✅ User created successfully:', {
            id: user._id,
            email: user.email,
            role: user.role
        });

        const token = generateToken(user._id);

        console.log('📤 Sending response...');
        res.status(201).json({
            success: true,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            batch: user.batch,
            token: token,
            message: 'Registration successful'
        });

        console.log('✅ Registration completed successfully!');
        console.log('🟢 ===== END REGISTRATION =====\n');

    } catch (error) {
        console.error('🔥 REGISTRATION ERROR:', error.message);
        console.error('🔥 Error details:', {
            name: error.name,
            code: error.code,
            stack: error.stack
        });
        
        // Handle specific MongoDB errors
        if (error.name === 'MongoError' && error.code === 11000) {
            console.log('❌ Duplicate key error (email already exists)');
            return res.status(400).json({ 
                success: false,
                message: 'Email already registered',
                error: 'DUPLICATE_EMAIL'
            });
        }
        
        if (error.name === 'ValidationError') {
            console.log('❌ Validation error:', error.errors);
            return res.status(400).json({ 
                success: false,
                message: 'Validation error',
                errors: error.errors 
            });
        }

        res.status(500).json({ 
            success: false,
            message: 'Registration failed. Please try again.',
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR'
        });
    }
});

// Login with detailed logging
router.post('/login', async (req, res) => {
    console.log('\n🔵 ===== LOGIN REQUEST =====');
    console.log('📦 Request Body:', req.body);

    try {
        const { email, password } = req.body;

        console.log('🔐 Login attempt for:', email);

        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({ 
                success: false,
                message: 'Please provide email and password' 
            });
        }

        console.log('🔍 Looking for user in database...');
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials - User not found' 
            });
        }

        console.log('✅ User found:', user.email);
        console.log('🔑 Comparing password...');
        const isPasswordMatch = await user.comparePassword(password);
        
        console.log('🔑 Password match result:', isPasswordMatch);
        
        if (!isPasswordMatch) {
            console.log('❌ Password incorrect for:', email);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials - Wrong password' 
            });
        }

        console.log('✅ Password correct!');
        const token = generateToken(user._id);

        res.json({
            success: true,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            batch: user.batch,
            token: token,
            message: 'Login successful'
        });

        console.log('✅ Login completed successfully!');
        console.log('🟢 ===== END LOGIN =====\n');

    } catch (error) {
        console.error('🔥 LOGIN ERROR:', error);
        res.status(500).json({ 
            success: false,
            message: 'Login failed. Please try again.',
            error: error.message 
        });
    }
});

// Test endpoint
router.get('/test', (req, res) => {
    console.log('🧪 Test endpoint called');
    res.json({ 
        success: true,
        message: 'Auth API is working',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Health check
router.get('/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'OK',
        service: 'Authentication Service',
        timestamp: new Date()
    });
});

// Get current user
router.get('/me', protect, async (req, res) => {
    try {
        console.log('👤 Getting current user for:', req.user.email);
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('❌ Error getting current user:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get user data' 
        });
    }
});

module.exports = router;