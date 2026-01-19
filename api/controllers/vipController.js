const VipPackage = require("../models/VipPackageModel");
const User = require("../models/UserModel");
const { Wallet, Transaction } = require("../models/WalletModel");

exports.createPackage = async (req, res) => {
    try {
        const { name, price, durationDays, priorityScore, description, perks, limitViewPhone } = req.body;
        const newPackage = await VipPackage.create({
            name, price, durationDays, priorityScore, description, perks, limitViewPhone: limitViewPhone || 0
        });
        res.status(201).json({ success: true, data: newPackage });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Updating package ${id} with data:`, req.body);

        const { name, price, durationDays, priorityScore, description, perks, limitViewPhone, isActive } = req.body;

        // Construct update object to ensure only valid fields are updated
        const updateData = {
            name, price, durationDays, priorityScore, description, perks, limitViewPhone, isActive
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
        const user = await User.findById(req.user.userId).select('vip');
        res.json({ success: true, data: user.vip });
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
