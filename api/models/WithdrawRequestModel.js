const mongoose = require("mongoose");

const WithdrawRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    bank: {
        bankName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        accountHolder: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED", "PAID"],
        default: "PENDING"
    },
    escalationLevel: { type: Number, default: 0 }, // 0: None, 1: 2h Reminder, 2: 24h Urgent
    adminNote: { type: String, default: "" },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date }, // Time when admin moves to APPROVED
    processedAt: { type: Date } // Time of last status change (or PAID)
}, { timestamps: true });

module.exports = mongoose.model("WithdrawRequest", WithdrawRequestSchema);
