const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, authorize } = require('../middleware/authMiddleware');

// Reuse upload config
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `ai-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage });

// @desc    Analyze space (Mock AI)
// @route   POST /api/features/analyze-space
// @access  Private (Club)
router.post('/analyze-space', protect, authorize('club'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image' });
        }

        // Mock Analysis Result
        const analysis = {
            capacity: Math.floor(Math.random() * (500 - 50 + 1) + 50),
            setupSuggestions: [
                'Use round tables for better interaction.',
                'Place the stage at the north end.',
                'Ensure 2m distance between rows.',
                'Add acoustic panels for better sound.'
            ],
            imageUrl: `/uploads/${req.file.filename}`
        };

        // Simulate processing time
        setTimeout(() => {
            res.json(analysis);
        }, 1500);

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
