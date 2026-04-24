const Report = require("../models/ReportModel");
const Post = require("../models/PostModel");
const i18n = require("../utils/i18n");

exports.createReport = async (req, res) => {
  try {
    const { reason, description } = req.body;
    const { postId } = req.params;
    const lang = req.headers["accept-language"]?.startsWith("en") ? "en" : "vi";
    // 1. Check if there is ANY pending report for this post by this user
    const pendingReport = await Report.findOne({
      postId,
      reporterId: req.user.userId,
      status: "PENDING"
    });
    if (pendingReport)
      return res.status(400).json({ success: false, message: i18n.t("reports.error_pending_post", lang) });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: i18n.t("reports.error_not_found", lang) });

    // Check if the user is reporting their own post
    if (post.userId.toString() === req.user.userId) {
      return res.status(400).json({ success: false, message: i18n.t("reports.error_self_report_post", lang) });
    }

    // 2. Check strict rule: Can only report again if post has been edited since last report
    const lastReport = await Report.findOne({
      postId,
      reporterId: req.user.userId
    }).sort({ createdAt: -1 });

    if (lastReport) {
      // If post.updatedAt is OLDER than or EQUAL to lastReport.createdAt, it implies no changes made.
      const lastReportTime = new Date(lastReport.createdAt).getTime();
      const postUpdateTime = new Date(post.updatedAt).getTime();

      if (postUpdateTime <= lastReportTime) {
        return res.status(400).json({ success: false, message: i18n.t("reports.error_not_edited", lang) });
      }
    }

    const report = await Report.create({
      postId,
      reporterId: req.user.userId,
      reason,
      description
    });

    // --- Notifications ---
    const NotificationController = require("./notificationController");
    const User = require("../models/UserModel");

    // 1. Notify Reporter (Confirmation)
    await NotificationController.createNotification({
      recipientId: req.user.userId,
      senderId: null, // System
      type: "SYSTEM",
      message: i18n.t("notifications.patterns.report_received", lang),
      relatedId: postId
    });

    // 1.1 Send Confirmation Email to Reporter
    const reporter = await User.findById(req.user.userId);
    if (reporter && reporter.email) {
      const emailService = require("../services/emailService");
      const post = await Post.findById(postId);
      await emailService.sendReportConfirmationEmail(
        reporter.email,
        reporter.name,
        'POST',
        post ? post.title : i18n.t("notifications.patterns.target_your_post", lang),
        reason,
        reporter.language || lang
      );
    }

    // 2. Notify Admins (New Report Alert)
    const admins = await User.find({ role: "ADMIN" }, "_id");
    if (admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        recipientId: admin._id,
        senderId: req.user.userId,
        type: "REPORT", // Special type key for Admin Dashboard
        message: i18n.t("notifications.patterns.new_report_post", lang, { reason }),
        relatedId: postId,
        isRead: false
      }));
      const Notification = require("../models/NotificationModel");
      await Notification.insertMany(adminNotifications);
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createUserReport = async (req, res) => {
  try {
    const { reason, description, targetUserId, chatRoomId } = req.body;
    const lang = req.headers["accept-language"]?.startsWith("en") ? "en" : "vi";

    if (targetUserId === req.user.userId) {
      return res.status(400).json({ success: false, message: i18n.t("reports.error_self_report_user", lang) });
    }

    // 1. Check if there is ANY pending report for this user by this reporter
    const pendingReport = await Report.findOne({
      targetUserId,
      reporterId: req.user.userId,
      status: "PENDING",
      type: "USER"
    });

    if (pendingReport)
      return res.status(400).json({ success: false, message: i18n.t("reports.error_pending_user", lang) });

    const report = await Report.create({
      targetUserId,
      chatRoomId, // Add this line
      reporterId: req.user.userId,
      reason,
      description,
      type: "USER"
    });

    // Notify Admins
    const User = require("../models/UserModel");
    const admins = await User.find({ role: "ADMIN" }, "_id");
    if (admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        recipientId: admin._id,
        senderId: req.user.userId,
        type: "REPORT",
        message: i18n.t("notifications.patterns.new_report_user", lang, { reason }),
        relatedId: report._id,
        isRead: false
      }));
      const Notification = require("../models/NotificationModel");
      await Notification.insertMany(adminNotifications);
    }

    // Notify Reporter (Confirmation Email + In-App)
    const reporter = await User.findById(req.user.userId);
    if (reporter) {
      // In-App Notification
      const NotificationController = require("./notificationController");
      await NotificationController.createNotification({
        recipientId: req.user.userId,
        senderId: null, // System
        type: "SYSTEM",
        message: i18n.t("notifications.patterns.report_received", lang),
        relatedId: report._id
      });

      // Email Confirmation
      if (reporter.email) {
        const emailService = require("../services/emailService");
        const targetUser = await User.findById(targetUserId);
        await emailService.sendReportConfirmationEmail(
          reporter.email,
          reporter.name,
          'USER',
          targetUser ? targetUser.name : i18n.t("notifications.patterns.target_your_account", lang),
          reason,
          reporter.language || lang
        );
      }
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllReports = async (req, res) => {
  const reports = await Report.find()
    .populate({
      path: "postId",
      select: "title userId",
      populate: {
        path: "userId",
        select: "name email violationCount isBanned"
      }
    })
    .populate("targetUserId", "name email violationCount isBanned") // Added population for user reports
    .populate("chatRoomId") // Populate chat room info
    .populate("reporterId", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: reports });
};

exports.resolveReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "RESOLVED" },
      { new: true }
    )
      .populate({
        path: 'postId',
        populate: { path: 'userId' } // Get owner of post
      })
      .populate('targetUserId'); // Get reported user

    let owner = null;
    if (report.type === 'USER' && report.targetUserId) {
      owner = report.targetUserId;
    } else if (report.postId && report.postId.userId) {
      owner = report.postId.userId;
    }

    const lang = owner.language || 'vi';

    if (owner) {
      // Increment violation count
      owner.violationCount = (owner.violationCount || 0) + 1;
      await owner.save();

      const emailService = require("../services/emailService");

      // Send Warning Email
      try {
        if (report.type === 'USER') {
          await emailService.sendUserViolationWarning(
            owner.email,
            owner.name,
            report.reason,
            report.description,
            lang
          );
        } else {
          await emailService.sendViolationWarning(
            owner.email,
            owner.name,
            report.postId ? report.postId.title : i18n.t("notifications.patterns.target_your_post", lang),
            report.reason,
            report.description,
            lang
          );
        }
      } catch (emailError) {
        console.error("Failed to send violation email:", emailError);
      }

      // Notify User (In-App)
      const NotificationController = require("./notificationController");
      const targetLabel = report.type === 'USER' 
        ? i18n.t("notifications.patterns.target_your_account", lang)
        : (report.postId ? `"${report.postId.title}"` : i18n.t("notifications.patterns.target_your_post", lang));

      await NotificationController.createNotification({
        recipientId: owner._id,
        senderId: null, // System
        type: "REPORT",
        message: i18n.t("notifications.patterns.violation_alert", lang, { target: targetLabel, reason: report.reason }),
        relatedId: report.postId ? report.postId._id : null
      });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectReport = async (req, res) => {
  try {
    const lang = req.headers["accept-language"]?.startsWith("en") ? "en" : "vi";
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "REJECTED" },
      { new: true }
    );
    res.json({ success: true, data: report, message: i18n.t("reports.success_rejected", lang) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const lang = req.headers["accept-language"]?.startsWith("en") ? "en" : "vi";
    await Report.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: i18n.t("reports.success_deleted", lang) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
