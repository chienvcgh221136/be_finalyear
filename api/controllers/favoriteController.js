const Favorite = require("../models/FavoriteModel");

exports.toggleFavorite = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const exist = await Favorite.findOne({ userId, postId });
        if (exist) {
            await exist.deleteOne();
            return res.json({ success: true, message: "Unfavorited" });
        }

        const Post = require("../models/PostModel");
        const User = require("../models/UserModel");
        const NotificationController = require("./notificationController");

        await Favorite.create({ userId, postId });

        // Notify Seller
        const post = await Post.findById(postId);
        if (post && post.userId.toString() !== userId) {
            const liker = await User.findById(userId);
            await NotificationController.createNotification({
                recipientId: post.userId,
                senderId: userId,
                type: "LIKE",
                message: `${liker.name} đã yêu thích bài đăng "${post.title}" của bạn.`,
                relatedId: post._id
            });
        }

        res.json({ success: true, message: "Favorited" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.myFavorites = async (req, res) => {
    const list = await Favorite.find({ userId: req.user.userId })
        .populate("postId", "title price images");
    res.json({ success: true, data: list });
};

module.exports = exports;