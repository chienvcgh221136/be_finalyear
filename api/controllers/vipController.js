const VipPackage = require("../models/VipPackageModel");
const User = require("../models/UserModel");
const { Wallet, Transaction } = require("../models/WalletModel");

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
