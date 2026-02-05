const Post = require("../models/PostModel");
const User = require("../models/UserModel");
const ViewHistory = require("../models/ViewHistoryModel");

exports.createPost = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        let postData = { ...req.body, userId: req.user.userId };

        if (user.vip && user.vip.isActive) {
            const now = new Date();
            if (!user.vip.expiredAt || new Date(user.vip.expiredAt) > now) {
                postData.vip = {
                    isActive: true,
                    vipType: user.vip.vipType,
                    priorityScore: user.vip.priorityScore || 0,
                    startedAt: now,
                    expiredAt: user.vip.expiredAt
                };
            }
        }

        const post = await Post.create(postData);

        // Notify User (Confirmation)
        const NotificationController = require("./notificationController");
        await NotificationController.createNotification({
            recipientId: req.user.userId,
            senderId: null, // System
            type: "SYSTEM",
            message: `Bài đăng "${post.title}" của bạn đã được tạo thành công và đang hiển thị.`,
            relatedId: post._id
        });

        res.status(201).json({ success: true, data: post });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getActivePosts = async (req, res) => {
    try {
        const { isVip, status, limit, transactionType, propertyType, q, city } = req.query;

        const safeStatus = (status === 'SOLD') ? 'SOLD' : 'ACTIVE';

        let query = { status: safeStatus };

        if (isVip === 'true') query['vip.isActive'] = true;
        if (transactionType) query.transactionType = transactionType;
        if (propertyType) query.propertyType = propertyType;

        if (city) {
            // Using regex for partial match on city name (flexible for "Ho Chi Minh" vs "TP.HCM")
            query['address.city'] = { $regex: city, $options: 'i' };
        }

        if (q) {
            const searchRegex = { $regex: q, $options: 'i' };
            // Scan multiple fields: Title, Desc, Address fields
            query.$or = [
                { title: searchRegex },
                { description: searchRegex },
                { 'address.street': searchRegex },
                { 'address.ward': searchRegex },
                { 'address.district': searchRegex },
                { 'address.city': searchRegex }
            ];
        }

        const pageValue = parseInt(req.query.page) || 1;
        const limitValue = parseInt(limit) || 12; // Default 12 per page
        const skip = (pageValue - 1) * limitValue;

        const total = await Post.countDocuments(query);
        const posts = await Post.find(query)
            .sort({ 'vip.priorityScore': -1, createdAt: -1 })
            .skip(skip)
            .limit(limitValue)
            .populate('userId', 'name avatar rating totalReviews');

        res.json({
            success: true,
            data: posts,
            pagination: {
                total,
                page: pageValue,
                limit: limitValue,
                totalPages: Math.ceil(total / limitValue)
            }
        });
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

exports.getPostsByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Post.find({
            userId: userId,
            status: { $in: ['ACTIVE', 'SOLD', 'RENTED'] }
        }).sort({ createdAt: -1 });

        res.json({ success: true, count: posts.length, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


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

                    // Record detailed View History
                    await ViewHistory.create({
                        postId: post._id,
                        viewerId: req.user ? req.user.userId : null,
                        ip: viewerIp,
                        userAgent: req.headers['user-agent']
                    });

                    // Set cache
                    viewCache.set(viewKey, Date.now());

                    // Auto expiry after 60 seconds
                    setTimeout(() => viewCache.delete(viewKey), 60000);
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

        if (req.user.role !== 'ADMIN') {
            req.body.status = "PENDING";
            req.body.rejectReason = null;
            req.body.approvedAt = null;
        }

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

        // Notify User
        const NotificationController = require("./notificationController");
        await NotificationController.createNotification({
            recipientId: post.userId,
            senderId: null, // System
            type: "SYSTEM",
            message: `Tin đăng "${post.title}" của bạn đã được duyệt và đang hiển thị công khai.`,
            relatedId: post._id
        });

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

        // Notify User
        const NotificationController = require("./notificationController");
        await NotificationController.createNotification({
            recipientId: post.userId,
            senderId: null, // System
            type: "SYSTEM",
            message: `Tin đăng "${post.title}" của bạn đã bị từ chối. Lý do: ${reason}`,
            relatedId: post._id
        });

        res.json({ success: true, message: "Post rejected" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

module.exports = exports;