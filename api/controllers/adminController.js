const User = require("../models/UserModel");
const Post = require("../models/PostModel");
const emailService = require("../services/emailService");

exports.banUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });

        // Ban user
        user.isBanned = true;
        await user.save();

        //Gỡ toàn bộ tin
        await Post.updateMany(
            { userId: user._id },
            { status: "REMOVED" }
        );

        res.json({
            success: true,
            message: "User banned and all posts removed"
        });

        // Send Email Notification
        const lang = user.language || 'vi';
        const reason = "Vi phạm quy định hệ thống / Community standards violation";
        await emailService.sendBanEmail(user.email, user.name, reason, lang);

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unbanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });

        user.isBanned = false;
        await user.save();

        res.json({
            success: true,
            message: "User unbanned"
        });

        // Send Email Notification
        const lang = user.language || 'vi';
        await emailService.sendUnbanEmail(user.email, user.name, lang);

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Delete user's posts
        await Post.deleteMany({ userId: user._id });

        // Delete user
        await User.findByIdAndDelete(req.params.userId);

        res.json({
            success: true,
            message: "User and their data deleted successfully"
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
