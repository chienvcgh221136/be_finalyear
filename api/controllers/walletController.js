const { Wallet, Transaction } = require("../models/WalletModel");
const User = require("../models/UserModel");

const getWallet = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId });
    }
    return wallet;
};

exports.getMe = async (req, res) => {
    try {
        const wallet = await getWallet(req.user.userId);
        res.json(wallet);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.topup = async (req, res) => {
    try {
        const { amount, method } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

        const wallet = await getWallet(req.user.userId);

        const isFirstTopup = wallet.totalTopup === 0;

        // Logic topup (simulated success)
        wallet.balance += amount;
        wallet.totalTopup += amount;
        await wallet.save();

        // Sync with User model to match legacy data structure
        await User.findByIdAndUpdate(req.user.userId, {
            'wallet.balance': wallet.balance
        });

        await Transaction.create({
            userId: req.user.userId,
            type: "TOPUP",
            amount,
            balanceAfter: wallet.balance,
            description: `Topup via ${method || 'BANK'}`
        });

        // --- POINT EARNING LOGIC ---
        const pointController = require("./pointController");
        let pointsEarned = Math.floor(amount / 1000);
        let bonusPoints = 0;

        if (isFirstTopup) {
            bonusPoints = 200;
            pointsEarned += bonusPoints;
        }

        if (pointsEarned > 0) {
            await pointController.addPoints(
                req.user.userId,
                isFirstTopup ? "FIRST_TOPUP_BONUS" : "TOPUP_REWARD",
                pointsEarned,
                null
            );
        }

        // Notify User
        const NotificationController = require("./notificationController");
        let notifMessage = `Nạp tiền thành công: +${amount.toLocaleString('vi-VN')}đ. Số dư hiện tại: ${wallet.balance.toLocaleString('vi-VN')}đ.`;
        if (pointsEarned > 0) {
            notifMessage += ` Bạn nhận được ${pointsEarned} điểm thưởng${isFirstTopup ? ' (bao gồm quà nạp đầu)!' : '!'}`;
        }

        await NotificationController.createNotification({
            recipientId: req.user.userId,
            senderId: null,
            type: "SYSTEM",
            message: notifMessage,
            relatedId: wallet.userId
        });

        res.json({ success: true, balance: wallet.balance, pointsEarned });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: transactions });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.sepayWebhook = async (req, res) => {
    try {
        const { gateway, transactionDate, accountProvided, referenceCode, transferAmount, content, transferType, transferContent } = req.body;

        const amount = Number(transferAmount);

        const description = content || transferContent || "";

        const match = description.match(/(NAPTIEN|TOPUP|DEPOSIT)\s+(\w+)/i);

        if (!match) {
            return res.json({ success: true, message: "Ignored: No User ID pattern match" });
        }

        const userId = match[2];

        const wallet = await getWallet(userId);
        if (!wallet) {
            return res.json({ success: false, message: "Wallet not found" });
        }

        const existingTxn = await Transaction.findOne({ description: { $regex: referenceCode, $options: 'i' } });
        if (existingTxn) return res.json({ success: true, message: "Transaction already processed" });

        const isFirstTopup = wallet.totalTopup === 0;

        wallet.balance += amount;
        wallet.totalTopup += amount;
        await wallet.save();

        const emailService = require('../services/emailService');

        const user = await User.findByIdAndUpdate(userId, {
            'wallet.balance': wallet.balance
        });

        await Transaction.create({
            userId,
            type: "TOPUP",
            amount,
            balanceAfter: wallet.balance,
            description: `Sepay: ${description} (Ref: ${referenceCode})`,
            refId: null
        });

        // --- POINT EARNING LOGIC ---
        const pointController = require("./pointController");
        let pointsEarned = Math.floor(amount / 1000);
        let bonusPoints = 0;

        if (isFirstTopup) {
            bonusPoints = 200;
            pointsEarned += bonusPoints;
        }

        if (pointsEarned > 0) {
            await pointController.addPoints(
                userId,
                isFirstTopup ? "FIRST_TOPUP_BONUS" : "TOPUP_REWARD",
                pointsEarned,
                null
            );
        }

        // Send Email Notification
        if (user && user.email) {
            emailService.sendTopupSuccessEmail(user.email, user.name, amount, wallet.balance, user.language || 'vi')
                .catch(err => console.error("Failed to send email:", err));
        }

        // Notify User
        const NotificationController = require("./notificationController");
        let notifMessage = `Nạp tiền thành công (Sepay): +${amount.toLocaleString('vi-VN')}đ. Số dư hiện tại: ${wallet.balance.toLocaleString('vi-VN')}đ.`;
        if (pointsEarned > 0) {
            notifMessage += ` Bạn nhận được ${pointsEarned} điểm thưởng${isFirstTopup ? ' (bao gồm quà nạp đầu)!' : '!'}`;
        }

        await NotificationController.createNotification({
            recipientId: userId,
            senderId: null,
            type: "SYSTEM",
            message: notifMessage,
            relatedId: null
        });

        return res.json({ success: true, message: "Topup Successful" });

    } catch (error) {
        console.error("Sepay Webhook Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
