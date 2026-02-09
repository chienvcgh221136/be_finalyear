const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional, system notifications might not have sender
    type: {
        type: String,
        enum: ["REPORT", "APPOINTMENT", "LIKE", "LEAD", "REVIEW", "SYSTEM", "POINT"],
        required: true
    },
    message: { type: String, required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // e.g. PostId, AppointmentId
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

// Index for faster queries by recipient
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
