const cron = require('node-cron');
const Post = require('../models/PostModel');
const User = require('../models/UserModel');
const VipPackage = require('../models/VipPackageModel');

// 4.1 Auto Bump VIP Posts
// Runs every hour to check bump eligibility
cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running Auto Bump VIP...');
    try {
        const vipPosts = await Post.find({ "vip.isActive": true });
        const now = new Date();

        for (const post of vipPosts) {
            // Determine bump frequency based on VIP type
            // BASIC: 12h, PRO: 6h, PREMIUM: 3h (Example mapping)
            let bumpIntervalHours = 12; // Default BASIC
            const vipType = post.vip.vipType.toUpperCase();

            if (vipType.includes('PRO')) bumpIntervalHours = 6;
            if (vipType.includes('PREMIUM')) bumpIntervalHours = 3;

            // Check last bump time (updatedAt)
            const hoursSinceLastBump = (now - new Date(post.updatedAt)) / (1000 * 60 * 60);

            if (hoursSinceLastBump >= bumpIntervalHours) {
                post.updatedAt = now;
                await post.save();
                console.log(`[CRON] Bumped post ${post._id} (${post.title})`);
            }
        }
    } catch (err) {
        console.error("[CRON] Auto Bump Error:", err);
    }
});

// 4.2 Rest Daily Limits (00:00)
cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running Daily VIP Reset...');
    try {
        // Find all users with active VIP
        const users = await User.find({ "vip.isActive": true });

        for (const user of users) {
            // 1. Detach all yesterday's VIP posts
            if (user.vip.currentVipPosts && user.vip.currentVipPosts.length > 0) {
                await Post.updateMany(
                    { _id: { $in: user.vip.currentVipPosts } },
                    {
                        $set: {
                            "vip.isActive": false,
                            "vip.priorityScore": 0,
                            "vip.startedAt": null,
                            "vip.expiredAt": null
                        }
                    }
                );
            }

            // 2. Reset Limits
            user.vip.dailyUsedSlots = 0;
            user.vip.currentVipPosts = [];

            // 3. Decrement Remaining Days
            if (user.vip.expiredAt) {
                // Check if expired
                if (new Date(user.vip.expiredAt) < new Date()) {
                    user.vip.isActive = false;
                    // Optional: Send email notification
                    console.log(`[CRON] VIP Expired for user ${user.name}`);
                }
            }

            await user.save();
        }
        console.log('[CRON] Daily reset completed.');
    } catch (err) {
        console.error("[CRON] Daily Reset Error:", err);
    }
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
