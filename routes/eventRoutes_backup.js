const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const { protect, authorize } = require('../middleware/authMiddleware');

// Multer config for image upload
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const checkFileType = (file, cb) => {
    const filetypes = /jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Images only!');
    }
}

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

// @desc    Get all events
// @route   GET /api/events
// @access  Public
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/events request received');
        // Filter: Date >= Today (Start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = await Event.find({ date: { $gte: today } }).populate('organizer', 'name college');
        console.log(`Found ${events.length} events`);
        res.json(events);
    } catch (error) {
        console.error('Error in GET /api/events:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('organizer', 'name college');
        if (event) {
            res.json(event);
        } else {
            res.status(404).json({ message: 'Event not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create event
// @route   POST /api/events
// @access  Private (Club/Admin)
router.post('/', protect, authorize('club', 'admin'), upload.single('poster'), async (req, res) => {
    try {
        const { title, description, date, time, endTime, location, capacity, category, bookingId } = req.body;

        let finalLocation = location;
        let finalDate = date;
        let finalTime = time;
        let venueId = null;
        let finalBookingId = null;

        if (bookingId) {
            const booking = await Booking.findById(bookingId).populate('venue');
            if (booking) {
                // Verify ownership (Club who booked it should use it)
                if (booking.user.toString() === req.user.id || req.user.role === 'admin') {
                    finalLocation = `${booking.venue.name} (${booking.venue.location})`;
                    venueId = booking.venue._id;
                    finalBookingId = bookingId;
                    // Optional: finalDate = booking.startTime...
                }
            }
        } else {
            // If no booking linked, check if the location string matches a real Venue
            // We assume the user might type "Auditorium" or "Block A"
            // To be safe, let's try to match by name exact or close
            const matchedVenue = await Venue.findOne({
                $or: [{ name: location }, { location: location }]
            });

            if (matchedVenue) {
                venueId = matchedVenue._id;

                // Enhanced conflict detection with time overlap checking
                const { endTime } = req.body; // Optional endTime from form

                // Check for conflicting events at the same venue
                const conflictingEvent = await Event.checkVenueConflict(
                    venueId,
                    date,
                    time,
                    endTime
                );

                if (conflictingEvent) {
                    return res.status(400).json({
                        message: `Venue '${matchedVenue.name}' is already booked for this time slot. Conflict with event: "${conflictingEvent.title}" scheduled at ${conflictingEvent.time}.`
                    });
                }

                // Also check Booking system for conflicts
                const startDateTime = new Date(`${date}T${time}`);
                let endDateTime;

                if (endTime) {
                    endDateTime = new Date(`${date}T${endTime}`);
                } else {
                    // Default 3-hour duration for booking conflict check
                    endDateTime = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000);
                }

                const isBooked = await Booking.checkOverlap(venueId, startDateTime, endDateTime);
                if (isBooked) {
                    return res.status(400).json({
                        message: `Venue '${matchedVenue.name}' is already reserved via the Booking system for this time slot.`
                    });
                }
            }
        }

        const event = await Event.create({
            title,
            description,
            date: finalDate,
            time: finalTime,
            endTime: endTime || null,
            location: finalLocation,
            capacity,
            category: category || 'General',
            organizer: req.user._id,
            venue: venueId,
            booking: finalBookingId,
            poster: req.file ? `/uploads/${req.file.filename}` : '',
        });

        res.status(201).json(event);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Invalid event data' });
    }
});

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Owner/Admin)
router.put('/:id', protect, authorize('club', 'admin'), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Make sure user is event owner or admin
        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.json(updatedEvent);
    } catch (error) {
        res.status(400).json({ message: 'Error updating event' });
    }
});

// @desc    Update event layout
// @route   PUT /api/events/:id/layout
// @access  Private (Owner/Admin)
router.put('/:id/layout', protect, authorize('club', 'admin'), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        event.layout = req.body.layout;
        await event.save();

        res.json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Owner/Admin)
router.delete('/:id', protect, authorize('club', 'admin'), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Check for passkey if there's a venue
        if (event.venue) {
            // Get passkey from body
            const { passkey } = req.body;

            if (!passkey) {
                return res.status(400).json({ message: 'Passkey is required to delete this event' });
            }

            const venue = await Venue.findById(event.venue).select('+bookingPasskey');
            if (!venue) {
                // If venue doesn't exist anymore, maybe just allow delete? 
                // But for safety let's assume if it has a venue ID it should be valid.
                // If null, we might skip. But safe to fail if unsure.
                // Let's assume if Venue is missing, we can proceed or warn. 
                // For now, if venue doc is gone but event has ID, just let them delete to fix state.
            } else {
                if (venue.bookingPasskey !== passkey) {
                    return res.status(401).json({ message: 'Invalid booking passkey' });
                }
            }
        }

        // Delete associated Booking if it exists
        if (event.booking) {
            await Booking.findByIdAndDelete(event.booking);
        }

        await event.deleteOne();

        res.json({ message: 'Event removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Register for event
// @route   POST /api/events/:id/register
// @access  Private (Student)
router.post('/:id/register', protect, authorize('student'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, rollNo, college } = req.body;

        // Check if already registered
        const existingReg = await Registration.findOne({
            user: req.user.id,
            event: id
        });

        if (existingReg) {
            return res.status(400).json({ message: 'Already registered' });
        }

        const registration = await Registration.create({
            user: req.user.id,
            event: id,
            name,
            email,
            phone,
            rollNo,
            college
        });

        res.status(201).json(registration);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get registration details (Verify Ticket)
// @route   GET /api/events/registrations/:id
// @access  Public
router.get('/registrations/:id', async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id)
            .populate('event', 'title date time location');

        if (!registration) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        res.json(registration);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Add comment to event
// @route   POST /api/events/:id/comments
// @access  Private
router.post('/:id/comments', protect, async (req, res) => {
    try {
        const { text } = req.body;
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const comment = {
            user: req.user.id,
            text,
            createdAt: new Date()
        };

        event.comments.unshift(comment);

        await event.save();

        res.json(event.comments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get event attendees
// @route   GET /api/events/:id/attendees
// @access  Private (Organizer/Admin)
router.get('/:id/attendees', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check authority
        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const registrations = await Registration.find({ event: req.params.id })
            .populate('user', 'name email college');

        res.json(registrations);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
