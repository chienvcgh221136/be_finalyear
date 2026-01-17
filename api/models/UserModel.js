

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER", },
    refreshToken: String,
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    avatar: { type: String, default: "" },
    vip: {
      isActive: { type: Boolean, default: false },
      vipType: { type: String, default: "NONE" },
      packageId: { type: mongoose.Schema.Types.ObjectId, ref: "VipPackage", default: null },
      priorityScore: { type: Number, default: 0 },
      startedAt: { type: Date, default: null },
      expiredAt: { type: Date, default: null },
    },
    wallet: {
      balance: { type: Number, default: 0 },
    }
  },

  {
    timestamps: true,
    collection: 'users'
  }
);

module.exports = mongoose.model("User", UserSchema);