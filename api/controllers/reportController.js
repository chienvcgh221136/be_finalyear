const Report = require("../models/ReportModel");
const Post = require("../models/PostModel");

exports.createReport = async (req, res) => {
  try {
    const { reason, description } = req.body;
    const { postId } = req.params;

    // 1. Check if there is ANY pending report for this post by this user
    const pendingReport = await Report.findOne({
      postId,
      reporterId: req.user.userId,
      status: "PENDING"
    });
    if (pendingReport)
      return res.status(400).json({ success: false, message: "Bạn đang có báo cáo chờ xử lý cho bài đăng này" });

    // 2. Check strict rule: Can only report again if post has been edited since last report
    const lastReport = await Report.findOne({
      postId,
      reporterId: req.user.userId
    }).sort({ createdAt: -1 });

    if (lastReport) {
      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ success: false, message: "Bài đăng không tồn tại" });

      // If post.updatedAt is OLDER than or EQUAL to lastReport.createdAt, it implies no changes made.
      // Note: We compare timestamps.
      const lastReportTime = new Date(lastReport.createdAt).getTime();
      const postUpdateTime = new Date(post.updatedAt).getTime();

      if (postUpdateTime <= lastReportTime) {
        return res.status(400).json({ success: false, message: "Bài đăng chưa được chỉnh sửa kể từ lần báo cáo trước. Bạn không thể báo cáo lại." });
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
      type: "SYSTEM", // or "REPORT_CONFIRMATION" if you want specific icon
      message: `Chúng tôi đã nhận được báo cáo của bạn về bài đăng. Cảm ơn bạn đã đóng góp cho cộng đồng.`,
      relatedId: postId
    });

    // 2. Notify Admins (New Report Alert)
    const admins = await User.find({ role: "ADMIN" }, "_id");
    if (admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        recipientId: admin._id,
        senderId: req.user.userId,
        type: "REPORT", // Special type key for Admin Dashboard
        message: `Báo cáo mới từ người dùng về bài đăng (Lý do: ${reason}).`,
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
    ).populate({
      path: 'postId',
      populate: { path: 'userId' } // Get owner of post
    });

    if (report && report.postId && report.postId.userId) {
      const owner = report.postId.userId;

      // Increment violation count
      owner.violationCount = (owner.violationCount || 0) + 1;
      await owner.save();

      const emailService = require("../services/emailService");

      // Send Warning Email
      await emailService.sendViolationWarning(
        owner.email,
        owner.name,
        report.postId.title,
        report.reason,
        report.description
      );

      // Notify User (In-App)
      const NotificationController = require("./notificationController");
      await NotificationController.createNotification({
        recipientId: owner._id,
        senderId: null, // System
        type: "REPORT",
        message: `Bài đăng "${report.postId.title}" của bạn đã bị báo cáo vi phạm: ${report.reason}. Vui lòng kiểm tra lại.`,
        relatedId: report.postId._id
      });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectReport = async (req, res) => {
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status: "REJECTED" },
    { new: true }
  );
  res.json({ success: true, data: report });
};

exports.deleteReport = async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Report deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

