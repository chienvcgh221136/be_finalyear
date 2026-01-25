const VipPackage = require("../models/VipPackageModel");
const User = require("../models/UserModel");
const { Wallet, Transaction } = require("../models/WalletModel");

exports.createPackage = async (req, res) => {
    try {
        const { name, price, durationDays, priorityScore, description, perks, limitViewPhone, postLimit, isPopular } = req.body;

        if (isPopular) {
            await VipPackage.updateMany({}, { isPopular: false });
        }

        const newPackage = await VipPackage.create({
            name, price, durationDays, priorityScore, description, perks, limitViewPhone: limitViewPhone || 0, postLimit: postLimit || 0, isPopular: isPopular || false
        });
        res.status(201).json({ success: true, data: newPackage });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Updating package ${id}. Body:`, JSON.stringify(req.body, null, 2));

        const { name, price, durationDays, priorityScore, description, perks, limitViewPhone, postLimit, isActive } = req.body;
        const isPopular = req.body.isPopular === true || req.body.isPopular === 'true';

        if (isPopular) {
            await VipPackage.updateMany({ _id: { $ne: id } }, { isPopular: false });
        }

        // Construct update object to ensure only valid fields are updated
        const updateData = {
            name, price, durationDays, priorityScore, description, perks, limitViewPhone, postLimit, isActive, isPopular
        };

        const updatedPackage = await VipPackage.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });

        if (!updatedPackage) {
            return res.status(404).json({ success: false, message: "Package not found" });
        }

        res.json({ success: true, data: updatedPackage });
    } catch (err) {
        console.error("Update package error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deletePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const pkg = await VipPackage.findById(id);
        if (pkg) {
            pkg.isActive = !pkg.isActive; // Toggle status
            await pkg.save();
        }
        res.json({ success: true, message: "Package status updated" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


exports.getPackages = async (req, res) => {
    try {
        const packages = await VipPackage.find({ isActive: true }).sort({ price: 1 });
        res.json({ success: true, data: packages });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.purchaseVip = async (req, res) => {
    try {
        const { packageId } = req.body;
        const userId = req.user.userId;

        const pkg = await VipPackage.findById(packageId);
        if (!pkg) return res.status(404).json({ message: "Package not found" });

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) return res.status(400).json({ message: "Wallet not found" });

        if (wallet.balance < pkg.price) {
            return res.status(400).json({ message: "Insufficient balance" });
        }

        // Deduct money
        wallet.balance -= pkg.price;
        wallet.totalSpent += pkg.price;
        await wallet.save();

        // Sync with User model
        await User.findByIdAndUpdate(userId, {
            'wallet.balance': wallet.balance
        });

        // Create transaction
        await Transaction.create({
            userId,
            type: "VIP_PURCHASE",
            amount: -pkg.price,
            balanceAfter: wallet.balance,
            refId: pkg._id,
            description: `Purchase VIP: ${pkg.name}`
        });

        // Update User VIP State
        const now = new Date();
        const expiredAt = new Date(now.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

        await User.findByIdAndUpdate(userId, {
            vip: {
                isActive: true,
                vipType: pkg.name,
                packageId: pkg._id,
                priorityScore: pkg.priorityScore,
                startedAt: now,
                expiredAt: expiredAt
            }
        });

        res.json({ success: true, message: "VIP Upgraded Successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMyVip = async (req, res) => {
    try {
        const Lead = require("../models/LeadModel");
        const user = await User.findById(req.user.userId)
            .select('vip')
            .populate('vip.packageId');

        // Calculate daily viewed phones
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayViewedPhones = await Lead.countDocuments({
            buyerId: req.user.userId,
            type: "SHOW_PHONE",
            createdAt: { $gte: startOfDay }
        });

        // Get limit with fallback
        let limitViewPhone = user.vip?.packageId?.limitViewPhone || 0;

        if (limitViewPhone === 0 && user.vip?.isActive && user.vip?.vipType) {
            const pkg = await VipPackage.findOne({ name: user.vip.vipType });
            if (pkg) {
                limitViewPhone = pkg.limitViewPhone || 0;
            }
        }

        const vipData = {
            ...user.vip.toObject(),
            todayViewedPhones,
            limitViewPhone
        };

        res.json({ success: true, data: vipData });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getAdminStats = async (req, res) => {
    try {
        const activeVipUsers = await User.countDocuments({ "vip.isActive": true });

        // Calculate Monthly Revenue (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const revenueAggregation = await Transaction.aggregate([
            {
                $match: {
                    type: "VIP_PURCHASE",
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" } } } // amount is negative for purchases
        ]);

        // Amount is stored as negative for spending, so we invert it. 
        // Or if you store positive... let's check purchaseVip logic: amount: -pkg.price
        const monthlyRevenue = revenueAggregation.length > 0 ? Math.abs(revenueAggregation[0].total) : 0;

        // Top Package
        const topPackageAggregation = await User.aggregate([
            { $match: { "vip.isActive": true } },
            { $group: { _id: "$vip.vipType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const topPackage = topPackageAggregation.length > 0 ? topPackageAggregation[0]._id : "N/A";

        res.json({
            success: true,
            data: {
                activeVipUsers,
                monthlyRevenue,
                topPackage
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getVipUsers = async (req, res) => {
    try {
        const users = await User.find({ "vip.isActive": true })
            .select("name email phone vip")
            .sort({ "vip.expiredAt": 1 });
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateUserVip = async (req, res) => {
    try {
        const { userId } = req.params;
        const { expiredAt, isActive, vipType } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (expiredAt) user.vip.expiredAt = new Date(expiredAt);
        if (typeof isActive === 'boolean') user.vip.isActive = isActive;
        if (vipType) user.vip.vipType = vipType; // Optional: Allow changing package type name manually

        // If deactivated, maybe clear current posts?
        // keeping it simple for now: valid posts will auto-expire if expiredAt is past or isActive false.

        await user.save();
        res.json({ success: true, message: "User VIP updated successfully", data: user.vip });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.attachVip = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { postIds } = req.body; // Expect array of post IDs

        if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
            return res.status(400).json({ message: "Invalid post IDs" });
        }

        const user = await User.findById(userId).populate("vip.packageId");
        if (!user.vip.isActive || !user.vip.packageId) {
            return res.status(403).json({ message: "No active VIP subscription" });
        }

        const now = new Date();
        if (user.vip.expiredAt && new Date(user.vip.expiredAt) < now) {
            return res.status(403).json({ message: "VIP subscription expired" });
        }

        const limit = user.vip.packageId.postLimit || 0;
        const currentUsed = user.vip.dailyUsedSlots || 0;
        const needed = postIds.length;

        if (currentUsed + needed > limit) {
            return res.status(400).json({
                message: `Not enough daily slots. Used: ${currentUsed}/${limit}. Needed: ${needed}.`
            });
        }

        const Post = require("../models/PostModel");

        // Find valid posts (owned by user, Active, not already VIP for today)
        const validPosts = await Post.find({
            _id: { $in: postIds },
            userId: userId,
            status: "ACTIVE",
            "vip.isActive": false // Only attach to non-VIP posts
        });

        if (validPosts.length !== postIds.length) {
            return res.status(400).json({ message: "Some posts are invalid, not active, or already VIP." });
        }

        // Attach VIP
        const priorityScore = user.vip.priorityScore;
        const start = new Date(); // now

        // Update posts
        await Post.updateMany(
            { _id: { $in: postIds } },
            {
                $set: {
                    "vip.isActive": true,
                    "vip.vipType": user.vip.vipType,
                    "vip.priorityScore": priorityScore,
                    "vip.startedAt": start,
                    "vip.expiredAt": null // Reset daily
                }
            }
        );

        // Update User
        user.vip.dailyUsedSlots += needed;
        validPosts.forEach(p => user.vip.currentVipPosts.push(p._id));
        await user.save();

        res.json({ success: true, message: `Attached VIP to ${validPosts.length} posts.` });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.detachVip = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { postIds } = req.body;

        if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
            return res.status(400).json({ message: "Invalid post IDs" });
        }

        const Post = require("../models/PostModel");
        const user = await User.findById(userId);

        // Detach VIP from posts
        await Post.updateMany(
            { _id: { $in: postIds }, userId: userId },
            {
                $set: {
                    "vip.isActive": false,
                    "vip.priorityScore": 0,
                    "vip.startedAt": null,
                    "vip.expiredAt": null
                }
            }
        );

        // Remove from currentVipPosts (but DO NOT decrement dailyUsedSlots)
        // using toString for comparison safely
        const detachIds = postIds.map(id => id.toString());
        user.vip.currentVipPosts = user.vip.currentVipPosts.filter(
            id => !detachIds.includes(id.toString())
        );

        await user.save();

        res.json({ success: true, message: "Detached VIP from posts." });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
