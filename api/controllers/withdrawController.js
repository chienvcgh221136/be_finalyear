const User = require("../models/UserModel");
const WithdrawRequest = require("../models/WithdrawRequestModel");
const { Wallet, Transaction } = require("../models/WalletModel");
const emailService = require("../services/emailService");
const crypto = require("crypto");

// requestWithdrawal: Validate balance, Generate OTP, Send Email
exports.initiateWithdraw = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Số tiền không hợp lệ" });
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ success: false, message: "Số dư không đủ" });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.withdrawalOTP = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send OTP Email
        if (emailService.sendWithdrawOTP) {
            await emailService.sendWithdrawOTP(user.email, user.name, otp, amount);
        } else {
            // Fallback if not configured properly
            console.log(`[DEV] OTP for ${user.email}: ${otp}`);
        }

        res.json({ success: true, message: "Mã OTP đã được gửi đến email của bạn" });
    } catch (error) {
        console.error("Initiate withdraw error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// verifyWithdraw: Check OTP, Deduct Balance, Create Request, Notify Admin
exports.verifyWithdraw = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { otp, amount, bank } = req.body;

        if (!otp || !amount || !bank) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin" });
        }

        const user = await User.findById(userId).select("+withdrawalOTP +otpExpires");
        if (!user || user.withdrawalOTP !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Mã OTP không đúng hoặc đã hết hạn" });
        }

        const wallet = await Wallet.findOne({ userId });
        if (wallet.balance < amount) {
            return res.status(400).json({ success: false, message: "Số dư không đủ" });
        }

        // Deduct Balance
        wallet.balance -= amount;
        wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + amount; // Track withdrawn separately
        await wallet.save();

        // Create Transaction
        await Transaction.create({
            userId,
            type: "WITHDRAW",
            amount: amount,
            balanceAfter: wallet.balance,
            description: `Yêu cầu rút tiền: ${amount.toLocaleString()} VNĐ`,
            refId: user._id
        });

        // Create Request
        const request = await WithdrawRequest.create({
            userId,
            amount,
            bank,
            status: "PENDING",
            requestedAt: new Date()
        });

        // Clear OTP
        user.withdrawalOTP = undefined;
        user.otpExpires = undefined;
        await user.save();

        // Notify Admin
        console.log("--- START ADMIN NOTIFICATION SEQUENCE ---");
        if (emailService.sendAdminWithdrawNotification) {
            console.log("Calling emailService.sendAdminWithdrawNotification...");
            await emailService.sendAdminWithdrawNotification(user.name, amount, request._id);
            console.log("Call to emailService completed.");
        } else {
            console.error("emailService.sendAdminWithdrawNotification is NOT defined!");
        }
        console.log("--- END ADMIN NOTIFICATION SEQUENCE ---");

        res.json({ success: true, message: "Yêu cầu rút tiền đã được gửi thành công", requestId: request._id });

    } catch (error) {
        console.error("Verify withdraw error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Get Requests
exports.getWithdrawRequests = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status && status !== 'ALL') query.status = status;

        const requests = await WithdrawRequest.find(query)
            .populate("userId", "name email phone avatar")
            .sort({ requestedAt: -1 });

        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Update Status
exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body; // status: APPROVED, REJECTED, PAID

        const request = await WithdrawRequest.findById(id).populate("userId");
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        if (["APPROVED", "REJECTED", "PAID"].includes(request.status) && request.status === status) {
            return res.status(400).json({ success: false, message: "Trạng thái không thay đổi" });
        }

        // Logic check: Cannot go back from PAID/REJECTED usually, but admin override allows it?
        // Let's implement Strict Flow: PENDING -> APPROVED/REJECTED -> PAID (from APPROVED).
        // Or simpler: PENDING -> APPROVED -> PAID or PENDING -> REJECTED.

        const oldStatus = request.status;
        request.status = status;
        request.adminNote = adminNote || "";
        request.processedAt = new Date(); // Update processed time on change
        await request.save();

        // Handle Refund if Rejected
        if (status === "REJECTED" && oldStatus !== "REJECTED") {
            // Only refund if we haven't already refunded (prev status wasn't REJECTED)
            // And assuming money was deducted at creation (YES).
            const wallet = await Wallet.findOne({ userId: request.userId._id });
            if (wallet) {
                wallet.balance += request.amount;
                wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) - request.amount; // Reverse withdrawn amount
                if (wallet.totalWithdrawn < 0) wallet.totalWithdrawn = 0; // Prevent negative
                await wallet.save();

                await Transaction.create({
                    userId: request.userId._id,
                    type: "REFUND",
                    amount: request.amount,
                    balanceAfter: wallet.balance,
                    description: `Hoàn tiền rút: ${request.amount.toLocaleString()} VNĐ (Từ chối bởi Admin)`,
                    refId: request._id
                });
            }
        }

        // Notify User
        if (emailService.sendWithdrawStatusUpdate) {
            await emailService.sendWithdrawStatusUpdate(request.userId.email, request.userId.name, status, request.amount, adminNote);
        }

        res.json({ success: true, request });
    } catch (error) {
        console.error("Update status error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
