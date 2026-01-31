const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    totalTopup: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
}, { timestamps: true });

const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
        type: String,
        enum: ['TOPUP', 'VIP_PURCHASE', 'POST_FEE', 'REFUND', 'WITHDRAW', 'VIP_UPGRADE'],
        required: true
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    refId: { type: mongoose.Schema.Types.ObjectId }, // Can be vipId or postId
    description: { type: String }
}, { timestamps: true });

module.exports = {
    Wallet: mongoose.model("Wallet", WalletSchema),
    Transaction: mongoose.model("Transaction", TransactionSchema)
};
