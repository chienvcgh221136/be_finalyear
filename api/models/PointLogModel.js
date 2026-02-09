const mongoose = require("mongoose");

const PointLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Earn or Spend
    type: { type: String, enum: ["EARN", "SPEND"], required: true },

    // Source of points or Reason for spending
    action: {
        type: String,
        required: true,
        enum: [
            // Earn
            "POST_CREATED",
            "POST_SOLD",
            "VIP_PURCHASE",
            "DAILY_LOGIN",
            "VIEW_MILESTONE",
            "ADMIN_BONUS",
            "ADMIN_ADJUSTMENT",
            "TOPUP_REWARD",
            "FIRST_TOPUP_BONUS",

            // Spend
            "REDEEM_POST_SLOT",
            "REDEEM_VIP_DAYS",
            "REDEEM_LEAD",
            "REDEEM_PRIORITY",

            // New Item Redemptions
            "REDEEM_ITEM_POST_PUSH",
            "REDEEM_ITEM_VIP_BRONZE_1DAY",
            "REDEEM_ITEM_VIP_SILVER_3DAY",
            "REDEEM_ITEM_VIP_GOLD_7DAY",
            "REDEEM_LEAD_CREDIT",

            // Item Usage
            "USE_ITEM_POST_PUSH",
            "USE_ITEM_VIP_BRONZE_1DAY",
            "USE_ITEM_VIP_SILVER_3DAY",
            "USE_ITEM_VIP_GOLD_7DAY",
            "USE_LEAD_CREDIT"
        ]
    },

    points: { type: Number, required: true }, // Absolute value

    // Optional metadata for linking to objects
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null }, // e.g. PostID, TransactionID
    description: { type: String, default: "" }

}, { timestamps: true, collection: "point_logs" });

module.exports = mongoose.model("PointLog", PointLogSchema);
