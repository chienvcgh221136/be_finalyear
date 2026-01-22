const mongoose = require("mongoose");

const VipPackageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    priorityScore: { type: Number, required: true },
    description: { type: String },
    perks: [{ type: String }],
    limitViewPhone: { type: Number, default: 0 }, // Daily limit for viewing phone numbers
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("VipPackage", VipPackageSchema);
