const Room = require('../models/Room');
const RoomStatusHelper = require('../utils/roomStatusHelper');

class StatusUpdater {
    constructor() {
        this.updateInterval = null;
        this.isRunning = false;
        this.lastUpdate = null;
    }
    
    start() {
        console.log('⏰ Starting automatic status updater...');
        
        // Update every 30 seconds
        this.updateInterval = setInterval(async () => {
            try {
                await this.updateAllRoomStatuses();
            } catch (error) {
                console.error('❌ Error in scheduled update:', error);
            }
        }, 30000); // 30 seconds
        
        // Also run immediately
        this.updateAllRoomStatuses();
        
        this.isRunning = true;
        console.log('✅ Status updater started (running every 30 seconds)');
    }
    
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            console.log('⏹️ Status updater stopped');
        }
        this.isRunning = false;
    }
    
    async updateAllRoomStatuses() {
        try {
            console.log('\n🔄 ===== UPDATING ALL ROOM STATUSES =====');
            const startTime = Date.now();
            this.lastUpdate = new Date();
            
            const rooms = await Room.find();
            console.log(`📊 Found ${rooms.length} rooms to update`);
            
            let updatedCount = 0;
            let skippedCount = 0;
            
            for (const room of rooms) {
                try {
                    console.log(`\n🔍 Checking room: ${room.roomNumber} - ${room.roomName}`);
                    
                    // Get current status from timetable
                    const status = await RoomStatusHelper.getCurrentRoomStatus(room._id);
                    
                    // Determine final status (manual override takes precedence)
                    let finalStatus = status.status;
                    let statusReason = status.reason;
                    
                    if (room.status && room.status !== 'empty') {
                        finalStatus = room.status;
                        statusReason = `Manually set to ${room.status}`;
                        console.log(`👤 Manual override: ${room.status}`);
                    }
                    
                    // Check if we need to update
                    const needsUpdate = (
                        room.autoStatus !== status.status ||
                        room.statusReason !== statusReason ||
                        !room.lastAutoUpdate ||
                        (Date.now() - room.lastAutoUpdate) > 60000 // Force update if >1 min old
                    );
                    
                    if (needsUpdate) {
                        console.log(`📝 Updating room ${room.roomNumber}:`);
                        console.log(`   Old autoStatus: ${room.autoStatus || 'none'}`);
                        console.log(`   New autoStatus: ${status.status}`);
                        console.log(`   Reason: ${statusReason}`);
                        
                        // Update room fields
                        room.autoStatus = status.status;
                        room.statusReason = statusReason;
                        room.lastAutoUpdate = new Date();
                        
                        // Update current class info
                        if (status.currentClass) {
                            room.currentClass = {
                                subject: status.currentClass.subject,
                                startTime: status.currentClass.startTime,
                                endTime: status.currentClass.endTime,
                                faculty: status.currentClass.faculty,
                                batch: status.currentClass.batch,
                                endsIn: this.calculateEndsIn(status.currentClass.endTime)
                            };
                            console.log(`   Current class: ${status.currentClass.subject}`);
                        } else {
                            room.currentClass = null;
                            console.log(`   No current class`);
                        }
                        
                        // Update next class info
                        if (status.nextClass) {
                            room.nextClass = {
                                subject: status.nextClass.subject,
                                startTime: status.nextClass.startTime,
                                endTime: status.nextClass.endTime,
                                faculty: status.nextClass.faculty,
                                batch: status.nextClass.batch
                            };
                            console.log(`   Next class: ${status.nextClass.subject} at ${status.nextClass.startTime}`);
                        } else {
                            room.nextClass = null;
                            console.log(`   No next class`);
                        }
                        
                        // Update computed status
                        room.computedStatus = finalStatus;
                        
                        // Calculate next optimal check time
                        room.nextStatusCheck = this.calculateNextCheckTime(status);
                        
                        await room.save();
                        updatedCount++;
                        
                    } else {
                        console.log(`⏭️ Skipping room ${room.roomNumber} - no changes needed`);
                        skippedCount++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Error updating room ${room?.roomNumber || 'unknown'}:`, error.message);
                }
            }
            
            const elapsedTime = Date.now() - startTime;
            console.log(`\n✅ Update completed in ${elapsedTime}ms`);
            console.log(`   Updated: ${updatedCount} rooms`);
            console.log(`   Skipped: ${skippedCount} rooms`);
            console.log(`   Total: ${rooms.length} rooms`);
            console.log('🔄 ===== UPDATE COMPLETE =====\n');
            
        } catch (error) {
            console.error('❌ Error in status updater:', error);
        }
    }
    
    calculateEndsIn(endTime) {
        const now = new Date();
        const [hours, minutes] = endTime.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(hours, minutes, 0, 0);
        
        const diffMs = endDate - now;
        const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
        
        return diffMinutes;
    }
    
    calculateNextCheckTime(status) {
        const now = new Date();
        
        if (status.currentClass) {
            // If class is ongoing, check when it ends
            const [hours, minutes] = status.currentClass.endTime.split(':').map(Number);
            const endTime = new Date();
            endTime.setHours(hours, minutes, 0, 0);
            
            // Check 1 minute after class ends
            return new Date(endTime.getTime() + 60000);
            
        } else if (status.nextClass) {
            // If next class is upcoming, check 5 minutes before it starts
            const [hours, minutes] = status.nextClass.startTime.split(':').map(Number);
            const startTime = new Date();
            startTime.setHours(hours, minutes - 5, 0, 0); // 5 minutes before
            
            // Don't check in the past
            return startTime > now ? startTime : new Date(now.getTime() + 300000); // 5 mins from now
            
        } else {
            // No classes, check in 30 minutes
            return new Date(now.getTime() + 1800000);
        }
    }
    
    // Force update a specific room
    async forceUpdateRoom(roomId) {
        try {
            console.log(`🔧 Force updating room ${roomId}...`);
            const room = await Room.findById(roomId);
            if (!room) {
                console.log(`❌ Room ${roomId} not found`);
                return;
            }
            
            const status = await RoomStatusHelper.getCurrentRoomStatus(roomId);
            
            room.autoStatus = status.status;
            room.statusReason = status.reason;
            room.lastAutoUpdate = new Date();
            room.nextStatusCheck = this.calculateNextCheckTime(status);
            
            if (status.currentClass) {
                room.currentClass = {
                    subject: status.currentClass.subject,
                    startTime: status.currentClass.startTime,
                    endTime: status.currentClass.endTime,
                    faculty: status.currentClass.faculty,
                    batch: status.currentClass.batch,
                    endsIn: this.calculateEndsIn(status.currentClass.endTime)
                };
            } else {
                room.currentClass = null;
            }
            
            if (status.nextClass) {
                room.nextClass = {
                    subject: status.nextClass.subject,
                    startTime: status.nextClass.startTime,
                    endTime: status.nextClass.endTime,
                    faculty: status.nextClass.faculty,
                    batch: status.nextClass.batch
                };
            } else {
                room.nextClass = null;
            }
            
            await room.save();
            console.log(`✅ Force updated room ${room.roomNumber}: ${status.status}`);
            
            return status;
            
        } catch (error) {
            console.error(`❌ Error force updating room ${roomId}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
const statusUpdater = new StatusUpdater();
module.exports = statusUpdater;