const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// @desc    Get all events
// @route   GET /api/events
// @access  Public
router.get('/', async (req, res) => {
    try {
        const events = await Event.find({ isExpired: false })
            .populate('organizer', 'name email')
            .populate('venue')
            .sort({ date: 1 });
        res.json(events);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get current user's registrations
// @route   GET /api/events/my-registrations
// @access  Private (Students)
router.get('/my-registrations', protect, authorize('student'), async (req, res) => {
    try {
        const Registration = require('../models/Registration');

        const registrations = await Registration.find({ user: req.user._id })
            .populate({
                path: 'event',
                populate: {
                    path: 'venue organizer',
                    select: 'name location email'
                }
            })
            .sort({ registeredAt: -1 });

        res.json(registrations);
    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations',
            error: error.message
        });
    }
});

// @desc    Check if user is registered for an event
// @route   GET /api/events/:id/check-registration
// @access  Private
router.get('/:id/check-registration', protect, async (req, res) => {
    try {
        const Registration = require('../models/Registration');

        const registration = await Registration.findOne({
            user: req.user._id,
            event: req.params.id
        });

        res.json({
            success: true,
            isRegistered: !!registration,
            registration: registration ? {
                _id: registration._id,
                qrCode: registration.qrCode,
                shareableToken: registration.shareableToken,
                registeredAt: registration.registeredAt
            } : null
        });
    } catch (error) {
        console.error('Check registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check registration status',
            error: error.message
        });
    }
});

// @desc    Verify registration by shareable token
// @route   GET /api/events/registration/:token
// @access  Public
router.get('/registration/:token', async (req, res) => {
    try {
        const Registration = require('../models/Registration');

        const registration = await Registration.findOne({
            shareableToken: req.params.token
        })
            .populate('event', 'title description date time location category organizer')
            .populate('user', 'name email college');

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found or invalid token'
            });
        }

        res.json({
            success: true,
            registration: {
                name: registration.name,
                email: registration.email,
                phone: registration.phone,
                rollNo: registration.rollNo,
                college: registration.college,
                department: registration.department,
                year: registration.year,
                qrCode: registration.qrCode,
                registeredAt: registration.registeredAt,
                verified: registration.verified,
                event: registration.event
            }
        });
    } catch (error) {
        console.error('Verify registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify registration',
            error: error.message
        });
    }
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'name email college')
            .populate('venue');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Create event with integrated slot selection
// @route   POST /api/events
// @access  Private (Club/Admin)
router.post('/', protect, authorize('club', 'admin'), upload.single('poster'), async (req, res) => {
    try {
        const { title, description, date, time, endTime, location, capacity, category, venueId } = req.body;

        // Validate required fields
        if (!title || !description || !date || !time || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: title, description, date, time, and endTime'
            });
        }

        // Validate and get venue
        let venue = null;
        if (venueId) {
            venue = await Venue.findById(venueId);
            if (!venue) {
                return res.status(404).json({
                    success: false,
                    message: 'Venue not found'
                });
            }
        } else if (location) {
            // Try to match venue by name or location
            venue = await Venue.findOne({
                $or: [{ name: location }, { location: location }]
            });
        }

        if (!venue) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid venue'
            });
        }

        // CRITICAL: Double-check slot availability to prevent race conditions
        const conflictingEvent = await Event.checkVenueConflict(
            venue._id,
            date,
            time,
            endTime
        );

        if (conflictingEvent) {
            return res.status(400).json({
                success: false,
                message: `This time slot is already booked. Conflict with event: "${conflictingEvent.title}" at ${conflictingEvent.time}`,
                conflictingEvent: {
                    title: conflictingEvent.title,
                    time: conflictingEvent.time
                }
            });
        }

        // Check Booking system for conflicts
        const startDateTime = new Date(`${date}T${time}`);
        const endDateTime = new Date(`${date}T${endTime}`);

        const isBooked = await Booking.checkOverlap(venue._id, startDateTime, endDateTime);
        if (isBooked) {
            return res.status(400).json({
                success: false,
                message: 'This venue is already reserved for this time slot'
            });
        }

        // Calculate expiration time (endTime + 1 hour)
        const expiresAt = new Date(endDateTime.getTime() + 60 * 60 * 1000);

        // Create the event
        const event = await Event.create({
            title,
            description,
            date,
            time,
            endTime,
            location: `${venue.name} (${venue.location})`,
            capacity: capacity || 100,
            category: category || 'General',
            organizer: req.user._id,
            venue: venue._id,
            poster: req.file ? `/uploads/${req.file.filename}` : '',
            status: 'upcoming',
            isExpired: false,
            expiresAt
        });

        // Create corresponding booking to lock the slot
        const booking = await Booking.create({
            venue: venue._id,
            user: req.user._id,
            startTime: startDateTime,
            endTime: endDateTime,
            purpose: `Event: ${title}`,
            linkedEvent: event._id
        });

        // Link booking to event
        event.booking = booking._id;
        await event.save();

        // Populate organizer details
        await event.populate('organizer', 'name email college');

        // Create notifications for students from the same college
        try {
            const User = require('../models/User');
            const Notification = require('../models/Notification');

            const students = await User.find({
                role: 'student',
                college: req.user.college
            }).select('_id');

            if (students.length > 0) {
                const studentIds = students.map(s => s._id);

                await Notification.createForUsers(studentIds, {
                    type: 'new_event',
                    event: event._id,
                    title: 'New Event Added',
                    message: `New event "${title}" has been added to your college calendar`
                });

                console.log(`[Event Creation] Created ${studentIds.length} notifications for new event: ${title}`);
            }
        } catch (notifError) {
            console.error('Notification creation error:', notifError);
            // Don't fail event creation if notification fails
        }

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            event,
            booking
        });
    } catch (error) {
        console.error('Event creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event. Please try again.',
            error: error.message
        });
    }
});

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Owner/Admin)
router.put('/:id', protect, upload.single('poster'), async (req, res) => {
    try {
        let event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check ownership
        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this event' });
        }

        // Update fields
        const updateData = { ...req.body };
        if (req.file) {
            updateData.poster = `/uploads/${req.file.filename}`;
        }

        event = await Event.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        res.json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Owner/Admin)
router.delete('/:id', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check ownership
        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete this event' });
        }

        await event.deleteOne();
        res.json({ message: 'Event removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Register for an event
// @route   POST /api/events/:id/register
// @access  Private (Students)
router.post('/:id/register', protect, authorize('student'), async (req, res) => {
    try {
        const Registration = require('../models/Registration');
        const Notification = require('../models/Notification');
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if already registered
        const existingRegistration = await Registration.findOne({
            user: req.user._id,
            event: req.params.id
        });

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'You are already registered for this event',
                alreadyRegistered: true,
                registration: {
                    _id: existingRegistration._id,
                    qrCode: existingRegistration.qrCode,
                    shareableToken: existingRegistration.shareableToken
                }
            });
        }

        // Check capacity
        const registrationCount = await Registration.countDocuments({ event: req.params.id });
        if (event.capacity && registrationCount >= event.capacity) {
            return res.status(400).json({
                success: false,
                message: 'Event is at full capacity'
            });
        }

        // Create registration
        const registration = new Registration({
            user: req.user._id,
            event: req.params.id,
            name: req.body.name || req.user.name,
            email: req.body.email || req.user.email,
            phone: req.body.phone || '',
            rollNo: req.body.rollNo || '',
            college: req.body.college || req.user.college || '',
            department: req.body.department || '',
            year: req.body.year || ''
        });

        // Generate shareable token
        registration.generateShareableToken();

        // Save first to get the ID
        await registration.save();

        // Generate QR code
        await registration.generateQRCode();
        await registration.save();

        // Create notification for successful registration
        await Notification.create({
            user: req.user._id,
            type: 'registration_confirmed',
            event: event._id,
            title: 'Registration Confirmed',
            message: `You have successfully registered for "${event.title}"`
        });

        // Populate event details for response
        await registration.populate('event', 'title date time location');

        res.status(201).json({
            success: true,
            message: 'Successfully registered for the event',
            registration: {
                _id: registration._id,
                name: registration.name,
                email: registration.email,
                phone: registration.phone,
                rollNo: registration.rollNo,
                college: registration.college,
                department: registration.department,
                year: registration.year,
                qrCode: registration.qrCode,
                shareableToken: registration.shareableToken,
                shareableLink: `${process.env.APP_URL || 'http://localhost:5000'}/verify-registration.html?token=${registration.shareableToken}`,
                event: registration.event,
                registeredAt: registration.registeredAt
            }
        });
    } catch (error) {
        console.error('Registration error:', error);

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'You are already registered for this event',
                alreadyRegistered: true
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to register for event',
            error: error.message
        });
    }
});

// @desc    Get event attendees
// @route   GET /api/events/:id/attendees
// @access  Private (Organizer/Admin)
router.get('/:id/attendees', protect, async (req, res) => {
    try {
        const Registration = require('../models/Registration');
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if user is organizer or admin
        if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const registrations = await Registration.find({ event: req.params.id })
            .populate('user', 'name email college');

        res.json(registrations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
