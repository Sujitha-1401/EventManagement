const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add an event title']
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    date: {
        type: Date,
        required: [true, 'Please add a date']
    },
    time: {
        type: String,
        required: [true, 'Please add a time']
    },
    endTime: {
        type: String, // Optional end time for better conflict detection
    },
    location: {
        type: String,
        required: [true, 'Please add a location']
    },
    poster: {
        type: String, // URL to uploaded image
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    invitations: [{ // Colleges invited
        type: String
    }],
    capacity: {
        type: Number
    },
    category: {
        type: String, // e.g., Workshops, Hackathons, Cultural
        default: 'General'
    },
    venue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue'
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    layout: {
        type: Object // For storing 2D planner data
    },
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        text: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['upcoming', 'live', 'full', 'expired'],
        default: 'upcoming'
    },
    isExpired: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date // endTime + 1 hour
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Static method to check for venue conflicts
// Checks if there's an overlapping event at the same venue on the same date
eventSchema.statics.checkVenueConflict = async function (venueId, date, startTime, endTime, excludeEventId = null) {
    if (!venueId) return null;

    // Parse the date and times to create DateTime objects
    const eventDate = new Date(date);
    const dateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Create start and end DateTime objects
    const startDateTime = new Date(`${dateStr}T${startTime}`);

    // If endTime is provided, use it; otherwise assume 3-hour duration
    let endDateTime;
    if (endTime) {
        endDateTime = new Date(`${dateStr}T${endTime}`);
    } else {
        endDateTime = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000); // +3 hours
    }

    // Find events at the same venue on the same date
    const query = {
        venue: venueId,
        date: eventDate
    };

    // Exclude current event if updating
    if (excludeEventId) {
        query._id = { $ne: excludeEventId };
    }

    const existingEvents = await this.find(query);

    // Check for time overlaps
    for (const event of existingEvents) {
        const existingStart = new Date(`${dateStr}T${event.time}`);
        let existingEnd;

        if (event.endTime) {
            existingEnd = new Date(`${dateStr}T${event.endTime}`);
        } else {
            existingEnd = new Date(existingStart.getTime() + 3 * 60 * 60 * 1000); // +3 hours default
        }

        // Check if times overlap: new start < existing end AND new end > existing start
        if (startDateTime < existingEnd && endDateTime > existingStart) {
            return event; // Conflict found
        }
    }

    return null; // No conflict
};

// Static method to get available time slots for a venue on a specific date
eventSchema.statics.getAvailableSlots = async function (venueId, date) {
    const slots = [];
    const dateStr = new Date(date).toISOString().split('T')[0];

    // Generate hourly slots from 8 AM to 8 PM
    for (let hour = 8; hour < 20; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

        // Check if this slot conflicts with any existing event
        const conflict = await this.checkVenueConflict(venueId, date, startTime, endTime);

        slots.push({
            startTime,
            endTime,
            available: !conflict,
            bookedBy: conflict ? (conflict.organizer ? 'other' : 'unknown') : null,
            eventTitle: conflict ? conflict.title : null
        });
    }

    return slots;
};

// Static method to expire old events (background job)
eventSchema.statics.expireOldEvents = async function () {
    const now = new Date();

    // Find events where end time + 1 hour has passed
    const events = await this.find({
        isExpired: false,
        expiresAt: { $lt: now }
    });

    for (const event of events) {
        event.isExpired = true;
        event.status = 'expired';
        await event.save();
    }

    return events.length;
};

// Instance method to update event status
eventSchema.methods.updateStatus = async function () {
    const now = new Date();
    const eventDate = new Date(this.date);

    if (this.endTime) {
        const endDateTime = new Date(`${eventDate.toISOString().split('T')[0]}T${this.endTime}`);

        if (endDateTime < now) {
            this.status = 'expired';
            this.isExpired = true;
        } else if (eventDate <= now && now < endDateTime) {
            this.status = 'live';
        } else {
            this.status = 'upcoming';
        }
    }

    await this.save();
};

module.exports = mongoose.model('Event', eventSchema);
