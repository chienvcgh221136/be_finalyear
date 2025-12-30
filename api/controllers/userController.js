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
    const users = await User.find({ role:"USER" }).select("-passwordHash");
    
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
      success:false,
      message:"User not found"
    });
    res.json({ success:true, data:user });
  } catch (err) {
    res.status(500).json({ success:false, message:"Server error" });
  }
};


module.exports = exports;