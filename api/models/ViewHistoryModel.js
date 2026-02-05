const mongoose = require("mongoose");

const ViewHistorySchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    viewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Null if guest
    ip: { type: String },
    userAgent: { type: String }
}, { timestamps: true });

// Index for fast aggregation by date and querying by post
ViewHistorySchema.index({ postId: 1, createdAt: -1 });
ViewHistorySchema.index({ createdAt: 1 });

module.exports = mongoose.model("ViewHistory", ViewHistorySchema);
