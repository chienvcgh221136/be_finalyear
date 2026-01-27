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

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllReports = async (req, res) => {
  const reports = await Report.find()
    .populate("postId", "title")
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
      const emailService = require("../services/emailService");

      // Send Warning Email
      await emailService.sendViolationWarning(
        owner.email,
        owner.name,
        report.postId.title,
        report.reason,
        report.description
      );
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
