const cron = require('node-cron');
const User = require('../models/UserModel');

// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running VIP Expiration Check...');

    try {
        const now = new Date();

        // Find users with active VIP that has expired
        const expiredVipUsers = await User.find({
            'vip.isActive': true,
            'vip.expiredAt': { $lte: now }
        });

        if (expiredVipUsers.length > 0) {
            console.log(`[CRON] Found ${expiredVipUsers.length} expired VIP users.`);

            for (const user of expiredVipUsers) {
                user.vip.isActive = false;
                user.vip.priorityScore = 0; // Reset priority
                // Optionally keep packageId for history, or clear it. 
                // Let's keep data but mark inactive.
                await user.save();
                console.log(`[CRON] Deactivated VIP for user: ${user.email}`);
            }
        } else {
            console.log('[CRON] No expired VIP packages found.');
        }

    } catch (error) {
        console.error('[CRON] Error in VIP Expiration Check:', error);
    }
});
