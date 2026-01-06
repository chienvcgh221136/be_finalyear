const Lead=require("../models/LeadModel");
const Post=require("../models/PostModel");

exports.showPhone=async(req,res)=>{
 try{
  const post=await Post.findById(req.params.postId).populate("userId","phone");
  if(!post) return res.status(404).json({success:false,message:"Post not found"});

  const lead=await Lead.findOne({postId:post._id,buyerId:req.user.userId})
   .populate("sellerId","name phone");

  if(!lead){
   await Lead.create({
    postId:post._id,
    buyerId:req.user.userId,
    sellerId:post.userId,
    type:"SHOW_PHONE"
   });
  }

  res.json({success:true,phone:post.userId.phone});
 }catch(err){
  res.status(500).json({success:false,message:err.message});
 }
};

module.exports=exports;