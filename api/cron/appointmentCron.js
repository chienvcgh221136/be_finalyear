const cron = require('node-cron');
const Appointment = require('../models/AppointmentModel');
const emailService = require('../services/emailService');

// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running Appointment Reminder Check...');

    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Find pending appointments created > 24h ago and NOT yet reminded
        const pendingAppointments = await Appointment.find({
            status: 'PENDING',
            createdAt: { $lte: twentyFourHoursAgo },
            reminded: { $ne: true }
        })
            .populate('sellerId', 'name email')
            .populate('buyerId', 'name email')
            .populate('postId', 'title');

        if (pendingAppointments.length > 0) {
            console.log(`[APPOINTMENT CRON] Found ${pendingAppointments.length} pending appointments to remind.`);
        }

        for (const ap of pendingAppointments) {
            try {
                // Validate data existence
                if (!ap.sellerId || !ap.buyerId || !ap.postId) {
                    console.warn(`[APPOINTMENT CRON] Invalid data for Appointment ${ap._id}. Skipping.`);
                    continue;
                }

                // 1. Send Reminder to Seller
                await emailService.sendAppointmentReminderSeller(
                    ap.sellerId.email,
                    ap.sellerId.name,
                    ap.buyerId.name,
                    ap.postId.title,
                    ap.appointmentTime,
                    ap._id
                );

                // 2. Send Update to Buyer
                await emailService.sendAppointmentReminderBuyer(
                    ap.buyerId.email,
                    ap.buyerId.name,
                    ap.sellerId.name,
                    ap.postId.title,
                    ap.appointmentTime
                );

                // 3. Mark as Reminded
                ap.reminded = true;
                await ap.save();
                console.log(`[APPOINTMENT CRON] Reminders sent for Appointment ${ap._id}`);

            } catch (innerError) {
                console.error(`[APPOINTMENT CRON] Error processing appointment ${ap._id}:`, innerError);
            }
        }

    } catch (error) {
        console.error('[CRON] Error in Appointment Reminder:', error);
    }
});
