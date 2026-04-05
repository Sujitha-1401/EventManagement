const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['new_event', 'event_expired', 'event_updated', 'registration_confirmed'],
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    },
    message: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

// Static method to create notification for multiple users
notificationSchema.statics.createForUsers = async function (userIds, notificationData) {
    const notifications = userIds.map(userId => ({
        user: userId,
        ...notificationData
    }));

    return await this.insertMany(notifications);
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function (userId) {
    return await this.updateMany(
        { user: userId, read: false },
        { read: true }
    );
};

module.exports = mongoose.model('Notification', notificationSchema);
