const mongoose = require('mongoose');
const QRCode = require('qrcode');
const crypto = require('crypto');

const registrationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    rollNo: { type: String, required: true },
    college: { type: String, required: true },
    department: { type: String },
    year: { type: String },
    qrCode: { type: String }, // Base64 encoded QR code
    shareableToken: {
        type: String,
        unique: true,
        sparse: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    attended: {
        type: Boolean,
        default: false
    },
    registeredAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to prevent duplicate registrations
registrationSchema.index({ user: 1, event: 1 }, { unique: true });

// Generate shareable token
registrationSchema.methods.generateShareableToken = function () {
    this.shareableToken = crypto.randomBytes(32).toString('hex');
    return this.shareableToken;
};

// Generate QR code
registrationSchema.methods.generateQRCode = async function () {
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const qrData = `${baseUrl}/verify-registration.html?token=${this.shareableToken}`;

    try {
        this.qrCode = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 300,
            margin: 2
        });
        return this.qrCode;
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw error;
    }
};

module.exports = mongoose.model('Registration', registrationSchema);

