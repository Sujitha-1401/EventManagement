const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

const seedAdmin = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        const adminExists = await User.findOne({ email: 'admin@campus.com' });

        if (adminExists) {
            console.log('Admin user already exists.');
            if (adminExists.role !== 'admin') {
                adminExists.role = 'admin';
                await adminExists.save();
                console.log('Updated existing user to Admin role.');
            }
            process.exit();
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        await User.create({
            name: 'System Admin',
            email: 'admin@campus.com',
            password: hashedPassword,
            role: 'admin',
            college: 'Campus Connect',
            description: 'Main Administrator',
            verified: true
        });

        console.log('Admin user created successfully.');
        console.log('Email: admin@campus.com');
        console.log('Password: admin123');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedAdmin();
