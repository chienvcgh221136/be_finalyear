const Post=require("../models/PostModel");

exports.createPost=async(req,res)=>{
 try{
  const post=await Post.create({...req.body,userId:req.user.userId});
  res.status(201).json({success:true,data:post});
 }catch(err){
  res.status(400).json({success:false,message:err.message});
 }
};

exports.getActivePosts=async(req,res)=>{
 const posts=await Post.find({status:"ACTIVE"}).sort({priorityScore:-1,createdAt:-1});
 res.json({success:true,count:posts.length,data:posts});
};

exports.getMyPosts=async(req,res)=>{
 const posts=await Post.find({userId:req.user.userId});
 res.json({success:true,data:posts});
};

exports.getPostById=async(req,res)=>{
 const post=await Post.findById(req.params.id).populate("userId","name phone rating");
 if(!post)return res.status(404).json({message:"Post not found"});
 res.json({success:true,data:post});
};

exports.updatePost=async(req,res)=>{
 const post=await Post.findById(req.params.id);
 if(!post)return res.status(404).json({message:"Post not found"});
 if(post.userId.toString()!==req.user.userId)
  return res.status(403).json({message:"Forbidden"});
 const updated=await Post.findByIdAndUpdate(req.params.id,req.body,{new:true});
 res.json({success:true,data:updated});
};

exports.deletePost=async(req,res)=>{
 const post=await Post.findById(req.params.id);
 if(!post)return res.status(404).json({message:"Post not found"});
 if(post.userId.toString()!==req.user.userId)
  return res.status(403).json({message:"Forbidden"});
 await post.deleteOne();
 res.json({success:true,message:"Post deleted"});
};

exports.markSold=async(req,res)=>{
 const post=await Post.findById(req.params.id);
 if(!post)return res.status(404).json({message:"Post not found"});
 if(post.userId.toString()!==req.user.userId)
  return res.status(403).json({message:"Forbidden"});
 post.status="SOLD";
 await post.save();
 res.json({success:true,message:"Post marked as SOLD"});
};

exports.approvePost=async(req,res)=>{
 const post=await Post.findById(req.params.id);
 if(!post)return res.status(404).json({message:"Post not found"});
 post.status="ACTIVE";
 post.rejectReason=null;
 await post.save();
 res.json({success:true,message:"Post approved"});
};

exports.rejectPost=async(req,res)=>{
 const {reason}=req.body;
 if(!reason)return res.status(400).json({message:"Reject reason required"});
 const post=await Post.findById(req.params.id);
 if(!post)return res.status(404).json({message:"Post not found"});
 post.status="REJECTED";
 post.rejectReason=reason;
 await post.save();
 res.json({success:true,message:"Post rejected"});
};

module.exports=exports;