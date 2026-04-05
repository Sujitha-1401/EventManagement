const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const { protect } = require('../middleware/authMiddleware');

// Get user's registrations
router.get('/registrations', protect, async (req, res) => {
    try {
        const registrations = await Registration.find({ user: req.user.id })
            .populate('event')
            .populate({
                path: 'event',
                populate: { path: 'organizer', select: 'name' }
            });
        res.json(registrations);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
