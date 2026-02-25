const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const RoomStatusHelper = require('../utils/roomStatusHelper');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');

// Get real-time status of all rooms
router.get('/live', protect, async (req, res) => {
    try {
        console.log('📡 Getting live status of all rooms...');
        
        const rooms = await Room.find().select('roomNumber roomName floor department status coordinates autoStatus statusReason currentClass nextClass lastAutoUpdate');
        
        const roomsWithStatus = await Promise.all(
            rooms.map(async (room) => {
                const status = await RoomStatusHelper.getCurrentRoomStatus(room._id);
                
                // Combine with manual status override
                let finalStatus = status.status;
                let statusReason = status.reason;
                
                // Manual override takes precedence
                if (room.status && room.status !== 'empty') {
                    finalStatus = room.status;
                    statusReason = `Manually set to ${room.status}`;
                }
                
                return {
                    ...room.toObject(),
                    timetableStatus: status,
                    finalStatus,
                    statusReason,
                    lastChecked: new Date()
                };
            })
        );
        
        res.json({
            success: true,
            timestamp: new Date(),
            totalRooms: roomsWithStatus.length,
            occupied: roomsWithStatus.filter(r => r.finalStatus === 'occupied').length,
            free: roomsWithStatus.filter(r => r.finalStatus === 'free').length,
            endingSoon: roomsWithStatus.filter(r => r.finalStatus === 'ending_soon').length,
            upcomingSoon: roomsWithStatus.filter(r => r.finalStatus === 'upcoming_soon').length,
            rooms: roomsWithStatus
        });
        
    } catch (error) {
        console.error('Error getting live status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get live status',
            error: error.message
        });
    }
});

// Get live status of a specific room
router.get('/live/:roomId', protect, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }
        
        const status = await RoomStatusHelper.getCurrentRoomStatus(roomId);
        
        // Get today's schedule
        const todaysSchedule = await RoomStatusHelper.getTodaysSchedule(roomId);
        
        // Get next 2 upcoming classes
        const upcomingClasses = todaysSchedule
            .filter(slot => slot.startTime > new Date().toTimeString().slice(0, 5))
            .slice(0, 2);
        
        res.json({
            success: true,
            room: {
                _id: room._id,
                roomNumber: room.roomNumber,
                roomName: room.roomName,
                floor: room.floor,
                department: room.department,
                capacity: room.capacity,
                roomType: room.roomType,
                coordinates: room.coordinates,
                autoStatus: room.autoStatus,
                statusReason: room.statusReason,
                lastAutoUpdate: room.lastAutoUpdate
            },
            currentStatus: status,
            todaysSchedule,
            upcomingClasses,
            manualStatus: room.status,
            lastUpdated: room.lastUpdated,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error getting room status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get room status',
            error: error.message
        });
    }
});

// Get today's schedule for a room
router.get('/schedule/today/:roomId', protect, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const todaysSchedule = await RoomStatusHelper.getTodaysSchedule(roomId);
        
        res.json({
            success: true,
            roomId,
            date: new Date().toDateString(),
            schedule: todaysSchedule,
            totalClasses: todaysSchedule.length
        });
        
    } catch (error) {
        console.error('Error getting today\'s schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get schedule',
            error: error.message
        });
    }
});

// Get weekly schedule for a room
router.get('/schedule/weekly/:roomId', protect, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const weeklySchedule = await RoomStatusHelper.getWeeklySchedule(roomId);
        
        res.json({
            success: true,
            roomId,
            weeklySchedule
        });
        
    } catch (error) {
        console.error('Error getting weekly schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get weekly schedule',
            error: error.message
        });
    }
});

// Check room availability at specific time
router.post('/check-availability', protect, async (req, res) => {
    try {
        const { roomId, date, startTime, endTime, day } = req.body;
        
        if (!roomId || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Room ID, start time, and end time are required'
            });
        }
        
        // If date is provided, use it to get day
        let targetDay = day;
        if (date && !day) {
            const targetDate = new Date(date);
            targetDay = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
        }
        
        if (!targetDay) {
            return res.status(400).json({
                success: false,
                message: 'Day or date is required'
            });
        }
        
        const hasConflict = await RoomStatusHelper.checkRoomConflict(
            roomId, 
            targetDay, 
            startTime, 
            endTime
        );
        
        res.json({
            success: true,
            available: !hasConflict,
            hasConflict,
            roomId,
            day: targetDay,
            startTime,
            endTime,
            checkTime: new Date()
        });
        
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check availability',
            error: error.message
        });
    }
});

// FORCE UPDATE ENDPOINTS

// Force update a specific room
router.post('/force-update/:roomId', protect, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const statusUpdater = require('../services/statusUpdater');
        const status = await statusUpdater.forceUpdateRoom(roomId);
        
        res.json({
            success: true,
            message: 'Room status force updated',
            status,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error force updating room:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to force update room',
            error: error.message
        });
    }
});

// Force update all rooms
router.post('/force-update-all', protect, async (req, res) => {
    try {
        const statusUpdater = require('../services/statusUpdater');
        await statusUpdater.updateAllRoomStatuses();
        
        res.json({
            success: true,
            message: 'All rooms force updated',
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error force updating all rooms:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to force update rooms',
            error: error.message
        });
    }
});

// Get status updater info
router.get('/updater-info', protect, async (req, res) => {
    try {
        const statusUpdater = require('../services/statusUpdater');
        
        res.json({
            success: true,
            isRunning: statusUpdater.isRunning,
            lastUpdate: statusUpdater.lastUpdate,
            timestamp: new Date(),
            description: 'Status updater runs every 30 seconds to check timetable and update room statuses'
        });
        
    } catch (error) {
        console.error('Error getting updater info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get updater info',
            error: error.message
        });
    }
});

module.exports = router;