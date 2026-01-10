const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: {
    type: String,
    enum: ["WRONG_INFO", "SCAM", "DUPLICATE", "SPAM", "OTHER"],
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
