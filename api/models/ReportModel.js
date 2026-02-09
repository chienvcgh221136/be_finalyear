const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" }, // Optional for User reports
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // For User reports
  chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom" }, // Optional, for context
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["POST", "USER"],
    default: "POST"
  },
  reason: {
    type: String,
    // enum: ["WRONG_INFO", "SCAM", "DUPLICATE", "SPAM", "OTHER"], // Let's keep it open or generic for now, or validation might fail if new reasons added
    required: true
  },
  description: { type: String },
  status: {
    type: String,
    enum: ["PENDING", "RESOLVED", "REJECTED"],
    default: "PENDING"
  }
}, { timestamps: true });

module.exports = mongoose.model("Report", reportSchema);
