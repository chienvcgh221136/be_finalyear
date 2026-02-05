const Lead = require("../models/LeadModel");
const Post = require("../models/PostModel");
const User = require("../models/UserModel");
const VipPackage = require("../models/VipPackageModel");

exports.showPhone = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        // Lấy post + seller
        const post = await Post.findById(postId)
            .populate("userId", "name phone");

        if (!post)
            return res.status(404).json({ success: false, message: "Post not found" });

        // Check đã từng xem số chưa
        let lead = await Lead.findOne({
            postId: post._id,
            buyerId: userId,
            type: "SHOW_PHONE"
        });

        // Nếu chưa xem và muốn xem mới -> Check VIP & Limit
        if (!lead) {
            const currentUser = await User.findById(userId);

            // 1. Check VIP
            if (!currentUser.vip || !currentUser.vip.isActive) {
                return res.status(403).json({
                    success: false,
                    message: "Bạn cần nâng cấp gói VIP để xem số điện thoại người đăng."
                });
            }

            // 2. Check Expired VIP
            if (new Date() > new Date(currentUser.vip.expiredAt)) {
                return res.status(403).json({
                    success: false,
                    message: "Gói VIP của bạn đã hết hạn. Vui lòng gia hạn."
                });
            }

            // 3. Check Limit View Phone per Day
            const pkg = await VipPackage.findById(currentUser.vip.packageId);
            const limit = pkg ? pkg.limitViewPhone : 0;

            // Count today's usage
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const todayCount = await Lead.countDocuments({
                buyerId: userId,
                type: "SHOW_PHONE",
                createdAt: { $gte: startOfDay }
            });

            if (todayCount >= limit) {
                return res.status(403).json({
                    success: false,
                    message: `Bạn đã đạt giới hạn xem ${limit} số điện thoại/ngày. Nâng cấp gói cao hơn để xem thêm.`
                });
            }

            lead = await Lead.create({
                postId: post._id,
                buyerId: userId,
                sellerId: post.userId._id,
                type: "SHOW_PHONE"
            });

            // Notify Seller
            const NotificationController = require("./notificationController");
            await NotificationController.createNotification({
                recipientId: post.userId._id,
                senderId: userId,
                type: "LEAD",
                message: `Người dùng ${currentUser.name} đã xem số điện thoại bài đăng "${post.title}".`,
                relatedId: post._id
            });

        }

        // 4. Calculate updated daily usage to return
        // Count today's usage again to be sure (including the one just created if any)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayViewedPhones = await Lead.countDocuments({
            buyerId: userId,
            type: "SHOW_PHONE",
            createdAt: { $gte: startOfDay }
        });

        // Get limit again or pass from above
        let limit = 0;
        const viewer = await User.findById(userId).populate('vip.packageId');

        if (viewer.vip?.isActive) {
            limit = viewer.vip.packageId?.limitViewPhone || 0;
            // Fallback
            if (limit === 0 && viewer.vip.vipType) {
                const pkg = await VipPackage.findOne({ name: viewer.vip.vipType });
                if (pkg) limit = pkg.limitViewPhone || 0;
            }
        }

        // Trả số điện thoại người bán + usage info
        res.json({
            success: true,
            seller: {
                id: post.userId._id,
                name: post.userId.name,
                phone: post.userId.phone
            },
            usage: {
                today: todayViewedPhones,
                limit: limit
            }
        });

    } catch (err) {
        console.error("Show phone error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = exports;
