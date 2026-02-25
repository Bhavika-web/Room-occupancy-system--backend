const Timetable = require('../models/Timetable');
const Room = require('../models/Room');

class RoomStatusHelper {
    
    /**
     * Get current room status based on timetable
     * @param {String} roomId - Room ID
     * @returns {Object} - Status object
     */
    static async getCurrentRoomStatus(roomId) {
        try {
            const now = new Date();
            const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
            const currentTime = now.toTimeString().slice(0, 5);
            
            console.log(`🕒 Checking status for room ${roomId} at ${currentTime} on ${currentDay}`);
            
            // Get active timetable for the room
            const timetable = await Timetable.findOne({
                room: roomId,
                isActive: true,
                validFrom: { $lte: now },
                $or: [
                    { validUntil: { $gte: now } },
                    { validUntil: { $exists: false } }
                ]
            }).populate('room', 'roomNumber roomName floor department');
            
            if (!timetable) {
                console.log(`📭 No active timetable for room ${roomId}`);
                return {
                    status: 'free',
                    reason: 'No timetable',
                    nextClass: null,
                    currentClass: null,
                    timetableActive: false,
                    lastUpdated: now
                };
            }
            
            console.log(`📅 Found timetable with ${timetable.slots.length} slots`);
            
            // Check for current class
            let currentClass = null;
            let nextClass = null;
            let allClassesToday = [];
            
            // Get all classes for today
            timetable.slots.forEach(slot => {
                if (slot.day === currentDay) {
                    allClassesToday.push(slot);
                    
                    // Check if this is the current class
                    const isCurrentClass = (
                        slot.startTime <= currentTime && 
                        slot.endTime >= currentTime
                    );
                    
                    if (isCurrentClass) {
                        currentClass = slot;
                        console.log(`🎯 Current class found: ${slot.subject} (${slot.startTime}-${slot.endTime})`);
                    }
                    
                    // Find next class (starting after current time)
                    if (slot.startTime > currentTime) {
                        if (!nextClass || slot.startTime < nextClass.startTime) {
                            nextClass = slot;
                        }
                    }
                }
            });
            
            // Sort today's classes by time
            allClassesToday.sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            // Determine status
            let status = 'free';
            let reason = 'Available';
            
            if (currentClass) {
                status = 'occupied';
                reason = `${currentClass.subject} with ${currentClass.faculty}`;
                
                // Check if class is about to end (last 5 minutes)
                const endTime = new Date();
                const [hours, minutes] = currentClass.endTime.split(':');
                endTime.setHours(hours, minutes, 0, 0);
                
                const timeDiff = (endTime - now) / (1000 * 60); // minutes
                
                if (timeDiff <= 5 && timeDiff > 0) {
                    status = 'ending_soon';
                    reason = `Class ending in ${Math.ceil(timeDiff)} minutes`;
                    console.log(`⏰ Class ending soon: ${Math.ceil(timeDiff)} minutes left`);
                }
                
                // Check if class has ended (timeDiff <= 0)
                if (timeDiff <= 0) {
                    status = 'free';
                    reason = 'Class has ended';
                    currentClass = null; // Clear current class if ended
                    console.log(`✅ Class has ended at ${currentClass?.endTime}`);
                }
                
            } else if (nextClass) {
                // Calculate time until next class
                const nextStart = new Date();
                const [hours, minutes] = nextClass.startTime.split(':');
                nextStart.setHours(hours, minutes, 0, 0);
                
                const timeDiff = (nextStart - now) / (1000 * 60);
                
                if (timeDiff <= 15 && timeDiff > 0) {
                    status = 'upcoming_soon';
                    reason = `Next class in ${Math.ceil(timeDiff)} minutes`;
                    console.log(`⏳ Next class soon: ${nextClass.subject} in ${Math.ceil(timeDiff)} mins`);
                } else {
                    status = 'free';
                    reason = 'Next class scheduled later';
                }
            } else {
                status = 'free';
                reason = 'No classes scheduled';
                console.log(`📭 No classes scheduled for today`);
            }
            
            // Log final status
            console.log(`📊 Final status for room: ${status} - ${reason}`);
            
            return {
                status,
                reason,
                currentClass,
                nextClass,
                allClassesToday,
                timetableActive: true,
                lastUpdated: now,
                checkTime: currentTime,
                room: timetable.room
            };
            
        } catch (error) {
            console.error(`❌ Error getting room status for ${roomId}:`, error);
            return {
                status: 'unknown',
                reason: 'Error checking timetable',
                error: error.message,
                lastUpdated: new Date()
            };
        }
    }
    
    /**
     * Get room status for a specific time
     * @param {String} roomId - Room ID
     * @param {Date} dateTime - Specific date and time
     * @returns {Object} - Status object
     */
    static async getRoomStatusAtTime(roomId, dateTime) {
        const targetDay = dateTime.toLocaleDateString('en-US', { weekday: 'long' });
        const targetTime = dateTime.toTimeString().slice(0, 5);
        
        const timetable = await Timetable.findOne({
            room: roomId,
            isActive: true,
            validFrom: { $lte: dateTime },
            $or: [
                { validUntil: { $gte: dateTime } },
                { validUntil: { $exists: false } }
            ]
        });
        
        if (!timetable) {
            return { status: 'free', reason: 'No timetable' };
        }
        
        let status = 'free';
        let currentClass = null;
        
        timetable.slots.forEach(slot => {
            if (slot.day === targetDay && 
                slot.startTime <= targetTime && 
                slot.endTime >= targetTime) {
                status = 'occupied';
                currentClass = slot;
            }
        });
        
        return {
            status,
            currentClass,
            checkTime: dateTime
        };
    }
    
    /**
     * Get today's schedule for a room
     * @param {String} roomId - Room ID
     * @returns {Array} - Today's schedule
     */
    static async getTodaysSchedule(roomId) {
        const today = new Date();
        const currentDay = today.toLocaleDateString('en-US', { weekday: 'long' });
        
        const timetable = await Timetable.findOne({
            room: roomId,
            isActive: true,
            validFrom: { $lte: today },
            $or: [
                { validUntil: { $gte: today } },
                { validUntil: { $exists: false } }
            ]
        });
        
        if (!timetable) {
            return [];
        }
        
        const todaysSlots = timetable.slots
            .filter(slot => slot.day === currentDay)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        return todaysSlots;
    }
    
    /**
     * Get weekly schedule for a room
     * @param {String} roomId - Room ID
     * @returns {Object} - Weekly schedule
     */
    static async getWeeklySchedule(roomId) {
        const timetable = await Timetable.findOne({
            room: roomId,
            isActive: true
        });
        
        if (!timetable) {
            return {};
        }
        
        const weeklySchedule = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };
        
        timetable.slots.forEach(slot => {
            if (weeklySchedule[slot.day]) {
                weeklySchedule[slot.day].push(slot);
            }
        });
        
        // Sort each day's slots by time
        Object.keys(weeklySchedule).forEach(day => {
            weeklySchedule[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        });
        
        return weeklySchedule;
    }
    
    /**
     * Check for room conflicts
     * @param {String} roomId - Room ID
     * @param {String} day - Day of week
     * @param {String} startTime - Start time
     * @param {String} endTime - End time
     * @param {String} excludeSlotId - Slot ID to exclude (for updates)
     * @returns {Boolean} - True if conflict exists
     */
    static async checkRoomConflict(roomId, day, startTime, endTime, excludeSlotId = null) {
        const timetable = await Timetable.findOne({
            room: roomId,
            isActive: true
        });
        
        if (!timetable) {
            return false;
        }
        
        for (const slot of timetable.slots) {
            // Skip the slot we're updating
            if (excludeSlotId && slot._id.toString() === excludeSlotId) {
                continue;
            }
            
            if (slot.day === day) {
                // Check for time overlap
                if ((startTime >= slot.startTime && startTime < slot.endTime) ||
                    (endTime > slot.startTime && endTime <= slot.endTime) ||
                    (startTime <= slot.startTime && endTime >= slot.endTime)) {
                    return true; // Conflict found
                }
            }
        }
        
        return false; // No conflict
    }
}

module.exports = RoomStatusHelper;