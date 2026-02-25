const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Room = require('../models/Room');
const OccupancyLog = require('../models/OccupancyLog');

// Get all rooms
router.get('/', protect, async (req, res) => {
    try {
        const rooms = await Room.find().sort('roomNumber');
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get rooms by floor
router.get('/floor/:floor', protect, async (req, res) => {
    try {
        const rooms = await Room.find({ floor: req.params.floor });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single room
router.get('/:id', protect, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update room status (CR only)
router.patch('/:id/status', protect, authorize('cr', 'admin'), async (req, res) => {
    try {
        const { status, reason } = req.body;
        
        const room = await Room.findById(req.params.id);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const previousStatus = room.status;
        room.status = status;
        room.lastUpdated = Date.now();
        room.updatedBy = req.user._id;
        
        await room.save();

        // Log the change
        await OccupancyLog.create({
            room: room._id,
            previousStatus,
            newStatus: status,
            changedBy: req.user._id,
            reason
        });

        res.json(room);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get occupancy logs for a room
router.get('/:id/logs', protect, async (req, res) => {
    try {
        const logs = await OccupancyLog.find({ room: req.params.id })
            .sort('-timestamp')
            .populate('changedBy', 'name email role')
            .limit(50);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;