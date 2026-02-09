const User = require("../models/UserModel");

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error("Error getting user:", err);
    res.status(400).json({
      success: false,
      message: "Invalid user id",
      error: err.message
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    console.error("Error getting users:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: err.message
    });
  }
};
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) return res.status(404).json({
      success: false,
      message: "User not found"
    });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar, coverImage } = req.body; // Allow updating name, phone, avatar, and coverImage
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;
    if (coverImage) user.coverImage = coverImage;

    await user.save();

    const updatedUser = await User.findById(userId).select("-passwordHash");

    res.json({
      success: true,
      data: updatedUser,
      message: "Profile updated successfully"
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: err.message
    });
  }
};


exports.blockUser = async (req, res) => {
  try {
    const { userIdToBlock } = req.body;
    const userId = req.user.userId;

    if (userId === userIdToBlock) {
      return res.status(400).json({ success: false, message: "Cannot block yourself" });
    }

    const user = await User.findById(userId);
    if (!user.blockedUsers.includes(userIdToBlock)) {
      user.blockedUsers.push(userIdToBlock);
      await user.save();
    }

    res.json({ success: true, message: "User blocked successfully", blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error("Block user error:", err);
    res.status(500).json({ success: false, message: "Error blocking user" });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userIdToUnblock } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userIdToUnblock);
    await user.save();

    res.json({ success: true, message: "User unblocked successfully", blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error("Unblock user error:", err);
    res.status(500).json({ success: false, message: "Error unblocking user" });
  }
};

exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate("blockedUsers", "name avatar");

    res.json({ success: true, blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error("Get blocked users error:", err);
    res.status(500).json({ success: false, message: "Error fetching blocked users" });
  }
};

module.exports = exports;