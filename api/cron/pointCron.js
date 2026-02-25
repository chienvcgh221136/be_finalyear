const cron = require('node-cron');
const PointLog = require('../models/PointLogModel');
const User = require('../models/UserModel');
const Notification = require('../models/NotificationModel');

const processPointExpiry = async () => {
    try {
        const now = new Date();
        console.log(`[Cron] Point Expiry Check started at ${now.toISOString()}`);

        // 1. Handle Expired Points
        const expiredBatches = await PointLog.find({
            type: 'EARN',
            remainingPoints: { $gt: 0 },
            expiryDate: { $ne: null, $lte: now }
        });

        for (const batch of expiredBatches) {
            const user = await User.findById(batch.userId);
            if (user) {
                const pointsToDeduct = batch.remainingPoints;
                user.points = Math.max(0, user.points - pointsToDeduct);
                await user.save();

                // Log the expiration
                await PointLog.create({
                    userId: batch.userId,
                    type: 'SPEND',
                    action: 'EXPIRED',
                    points: pointsToDeduct,
                    relatedId: batch._id,
                    description: `Điểm hết hạn: -${pointsToDeduct} điểm (từ lô tích ngày ${batch.createdAt.toLocaleDateString('vi-VN')})`
                });

                // Clear remaining points in the batch
                batch.remainingPoints = 0;
                await batch.save();

                // Notify user
                await Notification.create({
                    recipientId: batch.userId,
                    type: 'POINT',
                    message: `Bạn có ${pointsToDeduct} điểm đã hết hạn và bị trừ khỏi tài khoản.`
                });
            }
        }

        // 2. Handle Notifications (30, 7, 1 days before)
        const notificationThresholds = [
            { days: 30, field: 'notified30', message: (pts, date) => `Bạn có ${pts} điểm sắp hết hạn vào ngày ${date}. Hãy sử dụng ngay!` },
            { days: 7, field: 'notified7', message: (pts, date) => `NHẮC LẠI: Bạn có ${pts} điểm sắp hết hạn vào ngày ${date} (còn 7 ngày).` },
            { days: 1, field: 'notified1', message: (pts, date) => `CẢNH BÁO KHẨN: ${pts} điểm của bạn sẽ hết hạn vào ngày MAI (${date}).` }
        ];

        for (const threshold of notificationThresholds) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() + threshold.days);

            // Start of the day for checkDate
            const startOfCheckDay = new Date(checkDate.setHours(0, 0, 0, 0));
            const endOfCheckDay = new Date(checkDate.setHours(23, 59, 59, 999));

            const batchesToNotify = await PointLog.find({
                type: 'EARN',
                remainingPoints: { $gt: 0 },
                expiryDate: { $ne: null, $gte: startOfCheckDay, $lte: endOfCheckDay },
                [threshold.field]: false
            });

            for (const batch of batchesToNotify) {
                await Notification.create({
                    recipientId: batch.userId,
                    type: 'POINT',
                    message: threshold.message(batch.remainingPoints, batch.expiryDate.toLocaleDateString('vi-VN'))
                });

                batch[threshold.field] = true;
                await batch.save();
            }
        }

        console.log(`[Cron] Point Expiry Check completed.`);
    } catch (err) {
        console.error(`[Cron] Error in Point Expiry Check:`, err);
    }
};

// Run daily at midnight
cron.schedule('0 0 * * *', processPointExpiry);

module.exports = { processPointExpiry };
