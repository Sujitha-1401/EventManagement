const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get all venues with current availability status
// @route   GET /api/venues
// @access  Private (All users)
router.get('/', protect, async (req, res) => {
    try {
        const venues = await Venue.find({});
        const currentTime = new Date();

        // Check availability for each venue
        const venuesWithStatus = await Promise.all(venues.map(async (venue) => {
            const activeBooking = await Booking.findOne({
                venue: venue._id,
                startTime: { $lte: currentTime },
                endTime: { $gt: currentTime }
            });

            return {
                ...venue.toObject(),
                isBooked: !!activeBooking,
                currentBooking: activeBooking || null
            };
        }));

        res.json(venuesWithStatus);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get venue types with counts
// @route   GET /api/venues/types
// @access  Private (All users)
router.get('/types', protect, async (req, res) => {
    try {
        const types = await Venue.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $project: { type: '$_id', count: 1, _id: 0 } },
            { $sort: { type: 1 } }
        ]);
        res.json(types);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get venues by type
// @route   GET /api/venues/by-type/:type
// @access  Private (All users)
router.get('/by-type/:type', protect, async (req, res) => {
    try {
        const venues = await Venue.find({ type: req.params.type });
        res.json(venues);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get available time slots for a venue on a specific date
// @route   GET /api/venues/:id/slots/:date
// @access  Private (Club organizers)
router.get('/:id/slots/:date', protect, authorize('club'), async (req, res) => {
    try {
        const Event = require('../models/Event');
        const Booking = require('../models/Booking');

        const { id, date } = req.params;

        // Validate venue exists
        const venue = await Venue.findById(id);
        if (!venue) {
            return res.status(404).json({ message: 'Venue not found' });
        }

        // Get available slots from Event model
        const slots = await Event.getAvailableSlots(id, date);

        res.json(slots);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create a venue
// @route   POST /api/venues
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const venue = await Venue.create(req.body);
        res.status(201).json(venue);
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Venue name already exists' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update a venue
// @route   PUT /api/venues/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const venue = await Venue.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!venue) {
            return res.status(404).json({ message: 'Venue not found' });
        }
        res.json(venue);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete a venue
// @route   DELETE /api/venues/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const venue = await Venue.findByIdAndDelete(req.params.id);
        if (!venue) {
            return res.status(404).json({ message: 'Venue not found' });
        }

        // Also delete associated bookings
        await Booking.deleteMany({ venue: req.params.id });

        res.json({ message: 'Venue removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Book a venue
// @route   POST /api/venues/book
// @access  Private (Club)
router.post('/book', protect, authorize('club'), async (req, res) => {
    const { venueId, startTime, endTime, purpose, passkey } = req.body;

    try {
        const venue = await Venue.findById(venueId).select('+bookingPasskey');

        if (!venue) {
            return res.status(404).json({ message: 'Venue not found' });
        }

        // Verify Passkey
        if (venue.bookingPasskey !== passkey) {
            return res.status(401).json({ message: 'Invalid booking passkey' });
        }

        // Check for overlaps
        const isOverlapping = await Booking.checkOverlap(venueId, new Date(startTime), new Date(endTime));
        if (isOverlapping) {
            return res.status(400).json({ message: 'Venue is already booked for this time slot' });
        }

        const booking = await Booking.create({
            venue: venueId,
            user: req.user.id,
            startTime,
            endTime,
            purpose
        });

        res.status(201).json(booking);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get bookings for a specific venue and date
// @route   GET /api/venues/:id/bookings?date=YYYY-MM-DD
// @access  Private
router.get('/:id/bookings', protect, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date parameter is required' });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await Booking.find({
            venue: req.params.id,
            startTime: { $gte: startOfDay, $lte: endOfDay }
        }).select('startTime endTime purpose');

        res.json(bookings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get bookings for a user
// @route   GET /api/venues/bookings/my
// @access  Private
router.get('/bookings/my', protect, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user.id }).populate('venue');
        res.json(bookings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
