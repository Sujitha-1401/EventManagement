const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a venue name'],
        unique: true
    },
    capacity: {
        type: Number,
        required: [true, 'Please add capacity']
    },
    type: {
        type: String,
        enum: ['Auditorium', 'Seminar Hall', 'Conference Room', 'Open Ground', 'Lab', 'Classroom'],
        required: true
    },
    location: {
        type: String,
        required: [true, 'Please add location (e.g., Block A)']
    },
    bookingPasskey: {
        type: String,
        required: [true, 'Please set a booking passkey for organizers'],
        select: false // Hide by default
    },
    image: {
        type: String, // URL to image
        default: 'no-photo.jpg'
    },
    description: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Venue', venueSchema);
