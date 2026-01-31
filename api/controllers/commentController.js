const Comment = require("../models/CommentModel");
const Post = require("../models/PostModel");

// Get comments for a post
exports.getCommentsByPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const comments = await Comment.find({ postId })
            .populate("userId", "name avatar")
            .sort({ createdAt: -1 });
        res.json({ success: true, data: comments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Create a comment
exports.createComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;

        const comment = await Comment.create({
            postId,
            userId: req.user.userId,
            content
        });

        // Populate user details for immediate frontend display
        await comment.populate("userId", "name avatar");

        res.status(201).json({ success: true, data: comment });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Delete a comment (Owner or Admin)
exports.deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: "Comment not found" });

        if (comment.userId.toString() !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: "Forbidden" });
        }

        await comment.deleteOne();
        res.json({ success: true, message: "Comment deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
