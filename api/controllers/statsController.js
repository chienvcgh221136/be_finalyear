const Post = require("../models/PostModel");
const User = require("../models/UserModel");
const { Wallet } = require("../models/WalletModel");
const VipPackage = require("../models/VipPackageModel");
const ViewHistory = require("../models/ViewHistoryModel");
const Lead = require("../models/LeadModel");
const mongoose = require("mongoose");

exports.getMyStats = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Parallel queries
        const [posts, wallet] = await Promise.all([
            Post.find({ userId }),
            Wallet.findOne({ userId })
        ]);

        const totalPosts = posts.length;
        const activePosts = posts.filter(p => p.status === 'ACTIVE').length;
        const soldPosts = posts.filter(p => p.status === 'SOLD').length;
        const vipPosts = posts.filter(p => p.vip && p.vip.isActive).length;
        const totalViews = posts.reduce((sum, p) => sum + (p.viewCount || 0), 0);

        // Leads - Count how many times this user's phone was viewed
        const totalLeads = await Lead.countDocuments({
            sellerId: userId,
            type: "SHOW_PHONE"
        });

        // --- CHART DATA AGGREGATION ---
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const postIds = posts.map(p => p._id);

        const [viewsDaily, leadsDaily, postsDaily] = await Promise.all([
            ViewHistory.aggregate([
                { $match: { postId: { $in: postIds }, createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Lead.aggregate([
                { $match: { sellerId: userObjectId, createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Post.aggregate([
                { $match: { userId: userObjectId, createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Format data for the last 7 days
        const chartData = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];
            const displayDate = `${d.getDate()}/${d.getMonth() + 1}`;

            const viewCount = viewsDaily.find(item => item._id === dateString)?.count || 0;
            const leadCount = leadsDaily.find(item => item._id === dateString)?.count || 0;
            const postCount = postsDaily.find(item => item._id === dateString)?.count || 0;

            chartData.unshift({
                name: displayDate, // DD/MM
                views: viewCount,
                leads: leadCount,
                posts: postCount
            });
        }

        res.json({
            totalPosts,
            activePosts,
            soldPosts,
            totalViews,
            totalLeads,
            vipPosts,
            totalSpent: wallet ? wallet.totalSpent : 0,
            chartData
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAdminOverview = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPosts = await Post.countDocuments();

        // Calculate Wallet stats
        const wallets = await Wallet.find();
        const totalTopup = wallets.reduce((sum, w) => sum + (w.totalTopup || 0), 0);
        // VIP Revenue approximation (totalSpent might include post fees later, but for now mostly VIP)
        const vipRevenue = wallets.reduce((sum, w) => sum + (w.totalSpent || 0), 0);

        const activeVipUsers = await User.countDocuments({ 'vip.isActive': true });

        // Calculate total views across all posts
        // Use aggregate for better performance on large datasets if needed, but reduce is fine for now or find().select
        // Better: const result = await Post.aggregate([{ $group: { _id: null, total: { $sum: "$viewCount" } } }]);
        const allPosts = await Post.find({}, "viewCount");
        const totalViews = allPosts.reduce((sum, p) => sum + (p.viewCount || 0), 0);

        res.json({
            totalUsers,
            totalPosts,
            vipRevenue,
            topupRevenue: totalTopup,
            activeVipUsers,
            totalViews
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAdminRevenue = async (req, res) => {
    // Basic implementation placeholder
    res.json({ message: "Not implemented yet" });
};

exports.getAdminPostStats = async (req, res) => {
    try {
        const pendingCount = await Post.countDocuments({ status: 'PENDING' });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const approvedToday = await Post.countDocuments({
            status: 'ACTIVE',
            approvedAt: { $gte: startOfDay }
        });

        const rejectedCount = await Post.countDocuments({ status: 'REJECTED' });

        res.json({
            pending: pendingCount,
            approvedToday,
            rejected: rejectedCount
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
