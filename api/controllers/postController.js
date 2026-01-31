const Post = require("../models/PostModel");
const User = require("../models/UserModel");

exports.createPost = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        let postData = { ...req.body, userId: req.user.userId };

        // Apply VIP status if User is VIP and not expired
        if (user.vip && user.vip.isActive) {
            const now = new Date();
            if (!user.vip.expiredAt || new Date(user.vip.expiredAt) > now) {
                postData.vip = {
                    isActive: true,
                    vipType: user.vip.vipType,
                    priorityScore: user.vip.priorityScore || 0,
                    startedAt: now,
                    expiredAt: user.vip.expiredAt // Or based on post duration? Usually inherits user VIP status during creation
                };
            }
        }

        const post = await Post.create(postData);
        res.status(201).json({ success: true, data: post });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getActivePosts = async (req, res) => {
    try {
        const { isVip, status, limit, transactionType, propertyType } = req.query;

        // SECURITY: Only allow ACTIVE or SOLD posts in public listing. 
        // Ignore client 'status' if it tries to request PENDING/REJECTED.
        const safeStatus = (status === 'SOLD') ? 'SOLD' : 'ACTIVE';

        let query = { status: safeStatus };

        if (isVip === 'true') query['vip.isActive'] = true;
        if (transactionType) query.transactionType = transactionType;
        if (propertyType) query.propertyType = propertyType;

        const limitValue = limit ? parseInt(limit) : 0;

        const posts = await Post.find(query)
            .sort({ 'vip.priorityScore': -1, createdAt: -1 })
            .limit(limitValue)
            .populate('userId', 'name avatar rating totalReviews');

        res.json({ success: true, count: posts.length, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getMyPosts = async (req, res) => {
    try {
        const posts = await Post.find({ userId: req.user.userId });
        res.json({ success: true, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// Simple in-memory cache to prevent view spamming (resets on server restart)
// Key: "IP-PostID", Value: Timestamp
const viewCache = new Map();

exports.getPostById = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate("userId", "name phone rating totalReviews avatar");
        if (!post) return res.status(404).json({ message: "Post not found" });

        // Access Control
        const isPublic = post.status === 'ACTIVE' || post.status === 'SOLD';
        const isOwner = req.user && req.user.userId === post.userId._id.toString();
        const isAdmin = req.user && req.user.role === 'ADMIN';

        if (isPublic || isOwner || isAdmin) {

            // Increment view count logic with debounce (1 minute)
            if (!isOwner) {
                const viewerIp = req.ip || req.connection.remoteAddress;
                const viewKey = `${viewerIp}-${post._id}`;

                if (!viewCache.has(viewKey)) {
                    console.log(`[VIEW_COUNT] Incrementing for post ${post._id} by ${viewerIp}`);
                    await Post.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

                    // Set cache
                    viewCache.set(viewKey, Date.now());

                    // Auto expiry after 60 seconds
                    setTimeout(() => viewCache.delete(viewKey), 60000);
                } else {
                    // console.log(`[VIEW_COUNT] Debounced view for post ${post._id} by ${viewerIp}`);
                }
            }

            return res.json({ success: true, data: post });
        }

        return res.status(404).json({ message: "Post not found or restricted" });

    } catch (err) {
        res.status(400).json({ success: false, message: "Invalid Post ID or Server Error" });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        if (post.userId.toString() !== req.user.userId)
            return res.status(403).json({ message: "Forbidden" });
        const updated = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        if (post.userId.toString() !== req.user.userId && req.user.role !== 'ADMIN')
            return res.status(403).json({ message: "Forbidden" });
        await post.deleteOne();
        res.json({ success: true, message: "Post deleted" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.markSold = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        if (post.userId.toString() !== req.user.userId)
            return res.status(403).json({ message: "Forbidden" });

        post.status = "SOLD";
        await post.save();
        res.json({ success: true, message: "Post marked as SOLD" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.markRented = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        if (post.userId.toString() !== req.user.userId)
            return res.status(403).json({ message: "Forbidden" });

        // Toggle status: if already RENTED, set back to ACTIVE. Else set to RENTED.
        if (post.status === "RENTED") {
            post.status = "ACTIVE";
            await post.save();
            return res.json({ success: true, message: "Post marked as AVAILABLE (ACTIVE)" });
        } else {
            post.status = "RENTED";
            await post.save();
            return res.json({ success: true, message: "Post marked as RENTED" });
        }
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.approvePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        post.status = "ACTIVE";
        post.rejectReason = null;
        post.approvedAt = new Date();
        await post.save();
        res.json({ success: true, message: "Post approved" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.rejectPost = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ message: "Reject reason required" });
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: "Post not found" });
        post.status = "REJECTED";
        post.rejectReason = reason;
        await post.save();
        res.json({ success: true, message: "Post rejected" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

module.exports = exports;