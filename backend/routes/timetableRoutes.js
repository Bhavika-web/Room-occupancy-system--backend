const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Timetable = require('../models/Timetable');
const Room = require('../models/Room');

// Add timetable for a room
router.post('/', protect, authorize('cr', 'admin'), async (req, res) => {
    try {
        const { roomId, slots, semester, academicYear } = req.body;
        
        const timetable = await Timetable.create({
            room: roomId,
            slots,
            semester,
            academicYear
        });

        res.status(201).json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get timetable for a room
router.get('/room/:roomId', protect, async (req, res) => {
    try {
        const timetable = await Timetable.findOne({
            room: req.params.roomId,
            isActive: true
        }).populate('room', 'roomNumber roomName');
        
        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Check current occupancy based on timetable
router.get('/check/:roomId', protect, async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

        const timetable = await Timetable.findOne({
            room: req.params.roomId,
            isActive: true
        });

        let isOccupiedByTimetable = false;
        let currentClass = null;

        if (timetable) {
            for (const slot of timetable.slots) {
                if (slot.day === currentDay && 
                    slot.startTime <= currentTime && 
                    slot.endTime >= currentTime) {
                    isOccupiedByTimetable = true;
                    currentClass = slot;
                    break;
                }
            }
        }

        res.json({
            room: room,
            timetableOccupied: isOccupiedByTimetable,
            currentClass: currentClass,
            manualStatus: room.status,
            finalStatus: isOccupiedByTimetable ? 'occupied' : room.status
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;