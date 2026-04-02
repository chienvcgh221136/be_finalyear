const cron = require('node-cron');
const Post = require('../models/PostModel');
const User = require('../models/UserModel');



// 4.2 Rest Daily Limits (00:00)
cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running Daily VIP Reset...');
    try {
        // 1. Force detach ALL VIP posts system-wide for reliability
        await Post.updateMany(
            { "vip.isActive": true },
            {
                $set: {
                    "vip.isActive": false,
                    "vip.priorityScore": 0,
                    "vip.startedAt": null,
                    "vip.expiredAt": null,
                    "vip.vipType": "NONE"
                }
            }
        );

        // Find all users with active VIP OR those who have used slots/posts
        const users = await User.find({
            $or: [
                { "vip.isActive": true },
                { "vip.currentVipPosts": { $exists: true, $not: { $size: 0 } } },
                { "vip.dailyUsedSlots": { $gt: 0 } }
            ]
        });

        for (const user of users) {
            // 2. Reset Limits
            user.vip.dailyUsedSlots = 0;
            user.vip.currentVipPosts = [];

            // 3. Check Expiration
            if (user.vip.expiredAt) {
                if (new Date(user.vip.expiredAt) < new Date()) {
                    user.vip.isActive = false;
                    user.vip.vipType = "NONE";
                    user.vip.priorityScore = 0;
                    user.vip.packageId = null;
                    console.log(`[CRON] VIP Expired for user ${user.name}`);
                }
            }

            await user.save();
        }
        console.log('[CRON] Daily reset completed.');
    } catch (err) {
        console.error("[CRON] Daily Reset Error:", err);
    }
}, {
    timezone: "Asia/Ho_Chi_Minh"
});

// 4.3 Backup Expiration Check (Every 1 minute)
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        const expiredUsers = await User.find({
            "vip.isActive": true,
            "vip.expiredAt": { $lt: now }
        });

        if (expiredUsers.length > 0) {
            console.log(`[CRON] Found ${expiredUsers.length} expired VIP users.`);
        }

        for (const user of expiredUsers) {
            user.vip.isActive = false;
            user.vip.vipType = "NONE";
            user.vip.priorityScore = 0;
            user.vip.packageId = null;

            // Force detach any remaining VIP posts
            if (user.vip.currentVipPosts && user.vip.currentVipPosts.length > 0) {
                await Post.updateMany(
                    { _id: { $in: user.vip.currentVipPosts } },
                    { $set: { "vip.isActive": false, "vip.priorityScore": 0 } }
                );
                user.vip.currentVipPosts = [];
            }

            await user.save();
            console.log(`[CRON] Expired Check: Disabled VIP for user ${user.name} (${user._id})`);
        }
    } catch (err) {
        console.error("[CRON] Expiration Check Error:", err);
    }
});
