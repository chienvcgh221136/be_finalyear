const Post = require("../models/PostModel");
const User = require("../models/UserModel");
const { Wallet } = require("../models/WalletModel");
const VipPackage = require("../models/VipPackageModel");

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

        // Leads - currently just dummy or based on chat count? 
        // We don't have explicit leads tracking yet, will output 0 or random for now/mock
        // Or if we have ChatRooms, we could count strict 'leads'.
        // For now, let's keep it simple.
        const totalLeads = 0;

        res.json({
            totalPosts,
            activePosts,
            soldPosts,
            totalViews,
            totalLeads,
            vipPosts,
            totalSpent: wallet ? wallet.totalSpent : 0
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

        res.json({
            totalUsers,
            totalPosts,
            vipRevenue,
            topupRevenue: totalTopup,
            activeVipUsers
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAdminRevenue = async (req, res) => {
    // Basic implementation placeholder
    res.json({ message: "Not implemented yet" });
};
