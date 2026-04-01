const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get all users (or filter by role)
// @route   GET /api/admin/users
// @access  Private (Admin)
router.get('/users', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Verify a club
// @route   PUT /api/admin/verify/:id
// @access  Private (Admin)
router.put('/verify/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'club') {
            return res.status(400).json({ message: 'User is not a club' });
        }

        user.verified = true;
        await user.save();

        res.json({ message: 'Club verified' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
