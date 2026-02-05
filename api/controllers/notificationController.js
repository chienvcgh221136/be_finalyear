const Notification = require("../models/NotificationModel");

exports.createNotification = async ({ recipientId, senderId, type, message, relatedId }) => {
    try {
        const notification = new Notification({
            recipientId,
            senderId,
            type,
            message,
            relatedId
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        // We generally don't want to crash the main request if notification fails
        return null;
    }
};

// Get notifications for a user
exports.getUserNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate("senderId", "name avatar"); // Populate sender info if needed

        // Count unread
        const unreadCount = await Notification.countDocuments({
            recipientId: req.user.userId,
            isRead: false
        });

        res.status(200).json({ notifications, unreadCount });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipientId: req.user.userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found or unauthorized" });
        }

        res.status(200).json(notification);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user.userId, isRead: false },
            { isRead: true }
        );
        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// --- Admin Controllers ---

// Create System Notification
exports.createSystemNotification = async (req, res) => {
    try {
        const { recipientId, message, type = "SYSTEM", recipientType = "INDIVIDUAL", targetGroup } = req.body;

        let notifications = [];
        const User = require("../models/UserModel");

        if (recipientType === "ALL") {
            const users = await User.find({}, "_id");
            notifications = users.map(user => ({
                recipientId: user._id,
                senderId: req.user.userId,
                type,
                message,
                isRead: false
            }));
            await Notification.insertMany(notifications);

        } else if (recipientType === "ROLE") {
            // targetGroup: "ADMIN", "USER", "MODERATOR" (if added)
            // Note: DB roles are upper case usually
            const users = await User.find({ role: targetGroup }, "_id");
            notifications = users.map(user => ({
                recipientId: user._id,
                senderId: req.user.userId,
                type,
                message,
                isRead: false
            }));
            if (notifications.length > 0) await Notification.insertMany(notifications);

        } else if (recipientType === "GROUP") {
            let query = {};
            if (targetGroup === "VIP") {
                query = { "vip.isActive": true };
            } else if (targetGroup === "NEW_USER") {
                // Users created in last 7 days
                const last7Days = new Date();
                last7Days.setDate(last7Days.getDate() - 7);
                query = { createdAt: { $gte: last7Days } };
            }

            const users = await User.find(query, "_id");
            notifications = users.map(user => ({
                recipientId: user._id,
                senderId: req.user.userId,
                type,
                message,
                isRead: false
            }));
            if (notifications.length > 0) await Notification.insertMany(notifications);

        } else {
            // INDIVIDUAL (recipientId is a specific user ID)
            // Handle "ALL" passed as ID for backward compatibility or UI convenience
            if (recipientId === "ALL") {
                const users = await User.find({}, "_id");
                notifications = users.map(user => ({
                    recipientId: user._id,
                    senderId: req.user.userId,
                    type,
                    message,
                    isRead: false
                }));
                await Notification.insertMany(notifications);
            } else {
                const notification = new Notification({
                    recipientId,
                    senderId: req.user.userId,
                    type,
                    message
                });
                await notification.save();
                notifications.push(notification);
            }
        }

        res.status(201).json({ success: true, message: "Notification sent", count: notifications.length });
    } catch (error) {
        console.error("Create System Notification Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get All System Notifications (Sent by admins)
exports.getAllSystemNotifications = async (req, res) => {
    try {
        // Find notifications where type is SYSTEM or REPORT (activity)
        // Ideally we want to see what admins sent. 
        // For simplicity, let's just query notifications sent by this admin or all SYSTEM type.
        // Let's go with Type = "SYSTEM".
        const notifications = await Notification.find({ type: "SYSTEM" })
            .populate("recipientId", "name email")
            .populate("senderId", "name")
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete Notification
exports.deleteNotification = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Notification (Message only)
exports.updateNotification = async (req, res) => {
    try {
        const { message } = req.body;
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { message },
            { new: true }
        );
        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
