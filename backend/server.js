const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const statusRoutes = require('./routes/statusRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/status', statusRoutes);

// Basic route
app.get('/', (req, res) => {
    res.json({ message: 'Room Occupancy System API' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        status: 'ok',
        database: dbStatus,
        timestamp: new Date()
    });
});

const PORT = process.env.PORT || 5000;

// Start status updater after successful DB connection
mongoose.connection.once('open', async () => {
    console.log('✅ MongoDB connected, starting services...');
    
    try {
        // Import and start status updater
        const statusUpdater = require('./services/statusUpdater');
        
        // Start automatic status updates
        if (process.env.ENABLE_STATUS_UPDATER !== 'false') {
            statusUpdater.start();
            console.log('🚀 Status updater service started');
        } else {
            console.log('⏹️ Status updater disabled (ENABLE_STATUS_UPDATER=false)');
        }
        
        console.log('🚀 All services started successfully');
    } catch (error) {
        console.error('❌ Error starting services:', error.message);
        console.log('⚠️ Some services may not be available');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});