const Lead = require("../models/LeadModel");
const Post = require("../models/PostModel");

exports.showPhone = async (req, res) => {
 try {
  const { postId } = req.params;

  // Lấy post + seller
  const post = await Post.findById(postId)
   .populate("userId", "name phone");

  if (!post)
   return res.status(404).json({ success:false, message:"Post not found" });

  // Check đã từng xem số chưa
  let lead = await Lead.findOne({
   postId: post._id,
   buyerId: req.user.userId,
   type: "SHOW_PHONE"
  });

  // Nếu chưa thì tạo lead
  if (!lead) {
   lead = await Lead.create({
    postId: post._id,
    buyerId: req.user.userId,
    sellerId: post.userId._id,
    type: "SHOW_PHONE"
   });
  }

  // Trả số điện thoại người bán
  res.json({
   success: true,
   seller: {
    id: post.userId._id,
    name: post.userId.name,
    phone: post.userId.phone
   }
  });

 } catch (err) {
  console.error("Show phone error:", err);
  res.status(500).json({ success:false, message: err.message });
 }
};

module.exports = exports;
