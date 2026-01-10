const Report = require("../models/ReportModel");

exports.createReport = async (req, res) => {
  try {
    const { reason, description } = req.body;
    const { postId } = req.params;

    const existed = await Report.findOne({
      postId,
      reporterId: req.user.userId
    });
    if (existed)
      return res.status(400).json({ success:false, message:"You already reported this post" });

    const report = await Report.create({
      postId,
      reporterId: req.user.userId,
      reason,
      description
    });

    res.json({ success:true, data: report });
  } catch (err) {
    res.status(500).json({ success:false, message: err.message });
  }
};

exports.getAllReports = async (req, res) => {
  const reports = await Report.find()
    .populate("postId", "title")
    .populate("reporterId", "name email")
    .sort({ createdAt: -1 });

  res.json({ success:true, data: reports });
};

exports.resolveReport = async (req, res) => {
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status:"RESOLVED" },
    { new:true }
  );
  res.json({ success:true, data: report });
};

exports.rejectReport = async (req, res) => {
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status:"REJECTED" },
    { new:true }
  );
  res.json({ success:true, data: report });
};
