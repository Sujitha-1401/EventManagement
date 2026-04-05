const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    venue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: {
        type: Date,
        required: [true, 'Please add start time']
    },
    endTime: {
        type: Date,
        required: [true, 'Please add end time']
    },
    purpose: {
        type: String,
        required: [true, 'Please add a purpose for booking']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent booking overlaps for the same venue
// This checks if any booking exists where the new start time is before the existing end time 
// AND the new end time is after the existing start time.
bookingSchema.statics.checkOverlap = async function (venueId, startTime, endTime) {
    const existingBooking = await this.findOne({
        venue: venueId,
        $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
    });
    return !!existingBooking;
};

module.exports = mongoose.model('Booking', bookingSchema);
