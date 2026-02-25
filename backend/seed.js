const mongoose = require('mongoose');
const Room = require('./models/Room');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const sampleRooms = [
    {
        roomNumber: '101',
        roomName: 'Computer Lab 1',
        floor: '1',
        department: 'Computer Science',
        capacity: 40,
        roomType: 'lab',
        coordinates: { x: 50, y: 50, width: 120, height: 100 },
        status: 'empty'
    },
    {
        roomNumber: '102',
        roomName: 'Lecture Hall A',
        floor: '1',
        department: 'Computer Science',
        capacity: 60,
        roomType: 'classroom',
        coordinates: { x: 200, y: 50, width: 150, height: 100 },
        status: 'occupied'
    },
    // Add more rooms...
];

const seedDatabase = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/room_occupancy');
        
        // Clear existing data
        await Room.deleteMany({});
        await User.deleteMany({});
        
        // Create admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@college.edu',
            password: hashedPassword,
            role: 'admin',
            department: 'Computer Science',
            batch: 'Admin'
        });
        
        // Create rooms
        for (const roomData of sampleRooms) {
            roomData.updatedBy = admin._id;
            await Room.create(roomData);
        }
        
        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();