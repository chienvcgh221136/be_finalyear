const Favorite = require("../models/FavoriteModel");

exports.toggleFavorite = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;
        const lang = req.headers["accept-language"]?.startsWith("en") ? "en" : "vi";
        const i18n = require("../utils/i18n");

        const Favorite = require("../models/FavoriteModel");
        const Post = require("../models/PostModel");
        const User = require("../models/UserModel");
        const NotificationController = require("./notificationController");

        const exist = await Favorite.findOne({ userId, postId });
        if (exist) {
            await exist.deleteOne();
            return res.json({ success: true, message: i18n.t("favorites.success_unfavorited", lang), isFavorite: false });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        // Check if user is favoriting their own post
        if (post.userId.toString() === userId) {
            return res.status(400).json({ success: false, message: i18n.t("favorites.error_self_favorite", lang) });
        }

        await Favorite.create({ userId, postId });

        // Notify Seller
        if (post.userId.toString() !== userId) {
            const liker = await User.findById(userId);
            await NotificationController.createNotification({
                recipientId: post.userId,
                senderId: userId,
                type: "LIKE",
                message: i18n.t("notifications.patterns.post_liked", lang, { user: liker.name, post: post.title }),
                relatedId: post._id
            });
        }

        res.json({ success: true, message: i18n.t("favorites.success_favorited", lang), isFavorite: true });
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