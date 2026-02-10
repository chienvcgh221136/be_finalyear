const cron = require('node-cron');
const WithdrawRequest = require('../models/WithdrawRequestModel');
const emailService = require('../services/emailService');
const { Wallet, Transaction } = require('../models/WalletModel');


// Run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
    console.log('[CRON] Running Withdrawal Escalation Check...');

    try {
        const now = new Date();
        const pendingRequests = await WithdrawRequest.find({ status: 'PENDING' })
            .populate('userId', 'name email');

        for (const req of pendingRequests) {
            const diffMs = now - new Date(req.requestedAt);
            const diffHours = diffMs / (1000 * 60 * 60);

            // Level 1: Reminder (> 2 hours)
            if (diffHours >= 2 && req.escalationLevel < 1) {
                console.log(`[ESCALATION] Level 1 (Reminder) for Request ${req._id}`);
                await emailService.sendAdminWithdrawReminder(req.userId.name, req.amount, Math.floor(diffHours), req._id);
                req.escalationLevel = 1;
                await req.save();
            }

            // Level 2: Urgent (> 24 hours)
            else if (diffHours >= 24 && req.escalationLevel < 2) {
                console.log(`[ESCALATION] Level 2 (Urgent) for Request ${req._id}`);
                await emailService.sendAdminWithdrawUrgent(req.userId.name, req.amount, Math.floor(diffHours), req._id);
                req.escalationLevel = 2;
                await req.save();

                // TODO: Send SMS if provider integrated
            }

            // Level 3: Auto Reject (> 48 hours)
            else if (diffHours >= 48) {
                console.log(`[ESCALATION] Level 3 (Auto Reject) for Request ${req._id}`);

                // Auto Reject Logic (Duplicated safely from Controller)
                req.status = 'REJECTED';
                req.adminNote = 'Tự động từ chối do quá hạn xử lý (48h).';
                req.processedAt = new Date();
                req.escalationLevel = 3;
                await req.save();

                // Refund the user
                const wallet = await Wallet.findOne({ userId: req.userId._id });
                if (wallet) {
                    wallet.balance += req.amount;
                    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) - req.amount; // Reverse withdrawn amount
                    if (wallet.totalWithdrawn < 0) wallet.totalWithdrawn = 0;
                    await wallet.save();

                    await Transaction.create({
                        userId: req.userId._id,
                        type: "REFUND",
                        amount: req.amount,
                        balanceAfter: wallet.balance,
                        description: `Hoàn tiền rút: ${req.amount.toLocaleString()} VNĐ (Quá hạn xử lý)`,
                        refId: req._id
                    });
                }

                // Notify User
                if (emailService.sendWithdrawStatusUpdate) {
                    await emailService.sendWithdrawStatusUpdate(
                        req.userId.email,
                        req.userId.name,
                        'REJECTED',
                        req.amount,
                        'Yêu cầu bị từ chối tự động do quá hạn xử lý (48h).'
                    );
                }
            }
        }
    } catch (error) {
        console.error('[CRON] Error in Withdrawal Escalation:', error);
    }
});
