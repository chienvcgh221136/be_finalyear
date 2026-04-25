const Appointment = require("../models/AppointmentModel");
const Post = require("../models/PostModel");

const User = require("../models/UserModel");

const emailService = require("../services/emailService");
const i18n = require("../utils/i18n");

exports.createAppointment = async (req, res) => {
    try {
        const { appointmentTime, note } = req.body;
        // Populate seller to get email
        const post = await Post.findById(req.params.postId).populate("userId", "name email language");
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        // Populate buyer (current user) to get fields
        const buyer = await User.findById(req.user.userId);
        if (!buyer) return res.status(404).json({ success: false, message: "Buyer not found" });

        console.log("Creating appointment. Post:", post.title, "Seller:", post.userId.email, "Buyer:", buyer.email);

        const ap = await Appointment.create({
            postId: post._id,
            buyerId: req.user.userId,
            sellerId: post.userId?._id || post.userId, 
            appointmentTime,
            note
        });

        console.log(`[Appointment] Created: ${ap._id}. Sending emails...`);

        // Send Email to Sender (Buyer)
        try {
            const buyerSent = await emailService.sendAppointmentRequestSender(buyer.email, buyer.name, post.title, appointmentTime, buyer.language || 'vi');
            console.log(`[Appointment] Buyer Email Status: ${buyerSent ? 'SUCCESS' : 'FAILED'} (${buyer.email})`);
        } catch (emailErr) {
            console.error("[Appointment] Buyer Email Error:", emailErr);
        }

        // Send Email to Receiver (Seller)
        if (post.userId && post.userId.email) {
            try {
                const sellerSent = await emailService.sendAppointmentRequestReceiver(post.userId.email, post.userId.name, buyer.name, post.title, appointmentTime, note, post.userId.language || 'vi');
                console.log(`[Appointment] Seller Email Status: ${sellerSent ? 'SUCCESS' : 'FAILED'} (${post.userId.email})`);
            } catch (emailErr) {
                console.error("[Appointment] Seller Email Error:", emailErr);
            }
        } else {
            console.warn("[Appointment] Seller has no email or user not found. Skipping seller email.");
        }

        // Notify Seller
        const NotificationController = require("./notificationController");
        const buyerName = buyer.name || "Người dùng";
        const postTitle = post.title || "Bất động sản";
        const sellerLang = post.userId?.language || 'vi';

        await NotificationController.createNotification({
            recipientId: post.userId?._id || post.userId,
            senderId: req.user.userId,
            type: "APPOINTMENT",
            message: i18n.t('notifications.patterns.appointment_new', sellerLang, { name: buyerName, title: postTitle }),
            relatedId: ap._id
        });

        res.json({ success: true, data: ap });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateStatus = async (req, res) => {
    try {
        // Populate buyer to send status update email
        const ap = await Appointment.findById(req.params.id)
            .populate("buyerId", "name email language")
            .populate("postId", "title");

        if (!ap) return res.status(404).json({ success: false, message: "Not found" });
        if (ap.sellerId.toString() !== req.user.userId)
            return res.status(403).json({ success: false, message: "Forbidden" });

        ap.status = req.body.status;
        await ap.save();

        // Send Email to Buyer
        const buyerEmail = ap.buyerId?.email;
        const buyerName = ap.buyerId?.name || "Người dùng";
        const postTitle = ap.postId?.title || "Bất động sản";
        const lang = ap.buyerId?.language || 'vi';

        if (buyerEmail) {
            emailService.sendAppointmentStatusUpdate(
                buyerEmail, 
                buyerName, 
                postTitle, 
                ap.status, 
                ap.appointmentTime, 
                lang
            );
        }

        // Notify Buyer
        const NotificationController = require("./notificationController");
        const statusKey = ap.status === 'APPROVED' ? 'appointment_accepted' : 'appointment_rejected';
        
        await NotificationController.createNotification({
            recipientId: ap.buyerId?._id || ap.buyerId,
            senderId: req.user.userId, // Seller
            type: "APPOINTMENT",
            message: i18n.t(`notifications.patterns.${statusKey}`, lang, { post: postTitle }),
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
