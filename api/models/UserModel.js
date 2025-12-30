

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {type: String, required: true, trim: true},
    email: {type: String, required: true, unique: true, lowercase: true, trim: true},
    passwordHash: {type: String, required: true},
    phone: {type: String, required: true, unique: true, trim: true},
    role: {type: String, enum: ["USER", "ADMIN"], default: "USER",},
    refreshToken: String,
    isVerified: {type: Boolean, default: false},
    isBanned: {type: Boolean, default: false},
    rating: {type: Number, default: 0, min: 0, max: 5},
    totalReviews: {type: Number, default: 0}
  },
  { 
    timestamps: true,
    collection: 'users' 
  }
);

module.exports = mongoose.model("User", UserSchema);