const cron = require('node-cron');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');

// Run every hour to update event statuses and expire old events
cron.schedule('0 * * * *', async () => {
    try {
        console.log('[Event Lifecycle Job] Starting...');

        // Get events that will be expired
        const eventsToExpire = await Event.find({
            isExpired: false,
            expiresAt: { $lte: new Date() }
        });

        // Expire old events
        const expiredCount = await Event.expireOldEvents();
        console.log(`[Event Lifecycle Job] Expired ${expiredCount} events`);

        // Create notifications for expired events
        if (eventsToExpire.length > 0) {
            for (const event of eventsToExpire) {
                // Get all registered students for this event
                const registrations = await Registration.find({ event: event._id });

                if (registrations.length > 0) {
                    const userIds = registrations.map(reg => reg.user);

                    // Create notifications for all registered students
                    await Notification.createForUsers(userIds, {
                        type: 'event_expired',
                        event: event._id,
                        title: 'Event Expired',
                        message: `The event "${event.title}" has ended and is no longer active`
                    });

                    console.log(`[Event Lifecycle Job] Created ${userIds.length} expiration notifications for event: ${event.title}`);
                }
            }
        }

        // Update status for all active events
        const activeEvents = await Event.find({ isExpired: false });
        let updatedCount = 0;

        for (const event of activeEvents) {
            await event.updateStatus();
            updatedCount++;
        }

        console.log(`[Event Lifecycle Job] Updated ${updatedCount} event statuses`);
        console.log('[Event Lifecycle Job] Completed successfully');
    } catch (error) {
        console.error('[Event Lifecycle Job] Error:', error);
    }
});

console.log('[Event Lifecycle Job] Scheduled to run every hour');

module.exports = {};
