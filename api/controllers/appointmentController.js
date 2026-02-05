const Appointment = require("../models/AppointmentModel");
const Post = require("../models/PostModel");

const User = require("../models/UserModel");

const emailService = require("../services/emailService");

exports.createAppointment = async (req, res) => {
    try {
        const { appointmentTime, note } = req.body;
        // Populate seller to get email
        const post = await Post.findById(req.params.postId).populate("userId", "name email");
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        // Populate buyer (current user) to get fields
        const buyer = await User.findById(req.user.userId);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        console.log("Creating appointment. Post:", post.title, "Seller:", post.userId.email, "Buyer:", buyer.email);

        const ap = await Appointment.create({
            postId: post._id,
            buyerId: req.user.userId,
            sellerId: post.userId._id, // post.userId is now an object
            appointmentTime,
            note
        });

        // Send Email to Sender (Buyer)
        emailService.sendAppointmentRequestSender(buyer.email, buyer.name, post.title, appointmentTime);

        // Send Email to Receiver (Seller)
        emailService.sendAppointmentRequestReceiver(post.userId.email, post.userId.name, buyer.name, post.title, appointmentTime, note);

        // Notify Seller
        const NotificationController = require("./notificationController");
        await NotificationController.createNotification({
            recipientId: post.userId._id,
            senderId: req.user.userId,
            type: "APPOINTMENT",
            message: `${buyer.name} đã đặt lịch hẹn "${post.title}".`,
            relatedId: ap._id
        });

        res.json({ success: true, data: ap });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateStatus = async (req, res) => {
    try {
        // Populate buyer to send status update email
        const ap = await Appointment.findById(req.params.id)
            .populate("buyerId", "name email")
            .populate("postId", "title");

        if (!ap) return res.status(404).json({ success: false, message: "Not found" });
        if (ap.sellerId.toString() !== req.user.userId)
            return res.status(403).json({ success: false, message: "Forbidden" });

        ap.status = req.body.status;
        await ap.save();

        // Send Email to Buyer
        if (ap.buyerId && ap.buyerId.email) {
            emailService.sendAppointmentStatusUpdate(ap.buyerId.email, ap.buyerId.name, ap.postId.title, ap.status, ap.appointmentTime);
        }

        // Notify Buyer
        const NotificationController = require("./notificationController");
        await NotificationController.createNotification({
            recipientId: ap.buyerId._id,
            senderId: req.user.userId, // Seller
            type: "APPOINTMENT",
            message: `Lịch hẹn "${ap.postId.title}" của bạn đã chuyển sang trạng thái: ${req.body.status}.`,
            relatedId: ap._id
        });

        res.json({ success: true, data: ap });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.myAppointments = async (req, res) => {
    try {
        const userId = req.user.userId;

        const buy = await Appointment.find({ buyerId: userId })
            .populate("postId", "title images price address")
            .populate("sellerId", "name phone avatar")
            .sort({ createdAt: -1 });

        const sell = await Appointment.find({ sellerId: userId })
            .populate("postId", "title images price address")
            .populate("buyerId", "name phone avatar")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: { buy, sell } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.deleteAppointment = async (req, res) => {
    try {
        const ap = await Appointment.findById(req.params.id);
        if (!ap) return res.status(404).json({ success: false, message: "Appointment not found" });

        // Allow deletion if user is either buyer or seller
        if (ap.buyerId.toString() !== req.user.userId && ap.sellerId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        await Appointment.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Deleted successfully" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
