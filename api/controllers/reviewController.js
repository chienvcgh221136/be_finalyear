const Review = require("../models/ReviewModel");
const Lead = require("../models/LeadModel");
const Appointment = require("../models/AppointmentModel");
const User = require("../models/UserModel");
const Post = require("../models/PostModel"); // Added Post model import

exports.createReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const postId = req.params.postId;
        const buyerId = req.user.userId;

        // Find Post to get SellerId
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        const sellerId = post.userId;

        if (buyerId.toString() === sellerId.toString()) {
            return res.status(400).json({ success: false, message: "Cannot review your own post" });
        }

        // Check if already reviewed (optional, but good)
        // Logic removed: Validating Lead/Appointment (Making it open for all users)

        const rv = await Review.create({ postId, buyerId, sellerId, rating, comment });

        const seller = await User.findById(sellerId);
        // Use helper to be consistent
        await recalculateSellerRating(sellerId);

        // Populate for immediate return
        await rv.populate("buyerId", "name avatar");

        // Notify Seller
        const NotificationController = require("./notificationController");
        await NotificationController.createNotification({
            recipientId: sellerId,
            senderId: buyerId,
            type: "REVIEW",
            message: `${rv.buyerId.name} đã viết đánh giá cho bạn.`,
            relatedId: rv._id
        });

        res.json({ success: true, data: rv });
    } catch (e) {
        if (e.code === 11000)
            return res.status(400).json({ success: false, message: "Bạn đã đánh giá bài đăng này rồi" });
        res.status(500).json({ success: false, message: e.message });
    }
};

// Helper to recalculate seller rating
const recalculateSellerRating = async (sellerId) => {
    const reviews = await Review.find({ sellerId });
    const totalReviews = reviews.length;
    const seller = await User.findById(sellerId);

    if (!seller) return;

    if (totalReviews === 0) {
        seller.rating = 0;
        seller.totalReviews = 0;
    } else {
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        seller.rating = sum / totalReviews;
        seller.totalReviews = totalReviews;
    }
    await seller.save();
};

exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        // Allow Owner OR Admin to delete
        if (review.buyerId.toString() !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: "Forbidden" });
        }

        const sellerId = review.sellerId;
        await review.deleteOne();

        // Recalculate
        await recalculateSellerRating(sellerId);

        res.json({ success: true, message: "Review deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: "Review not found" });

        if (review.buyerId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (rating) review.rating = rating;
        if (comment) review.comment = comment;
        await review.save();

        await recalculateSellerRating(review.sellerId);

        res.json({ success: true, data: review });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSellerReviews = async (req, res) => {
    const list = await Review.find({ sellerId: req.params.sellerId })
        .populate("buyerId", "name avatar");
    res.json({ success: true, data: list });
};

exports.getReviewsByPost = async (req, res) => {
    const list = await Review.find({ postId: req.params.postId })
        .populate("buyerId", "name avatar")
        .sort({ createdAt: -1 });
    res.json({ success: true, data: list });
};
