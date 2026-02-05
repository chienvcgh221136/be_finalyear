

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    phone: { type: String, unique: true, trim: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER", },
    refreshToken: String,
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    avatar: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    violationCount: { type: Number, default: 0 },
    vip: {
      isActive: { type: Boolean, default: false },
      vipType: { type: String, default: "NONE" },
      packageId: { type: mongoose.Schema.Types.ObjectId, ref: "VipPackage", default: null },
      priorityScore: { type: Number, default: 0 },
      startedAt: { type: Date, default: null },
      expiredAt: { type: Date, default: null },
      dailyUsedSlots: { type: Number, default: 0 },
      currentVipPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }]
    },
    wallet: {
      balance: { type: Number, default: 0 },
    },
    withdrawalOTP: { type: String, select: false },
    otpExpires: { type: Date, select: false }
  },

  {
    timestamps: true,
    collection: 'users'
  }
);

module.exports = mongoose.model("User", UserSchema);