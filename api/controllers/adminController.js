const User = require("../models/UserModel");
const Post = require("../models/PostModel");

exports.banUser = async (req,res)=>{
 try{
  const user = await User.findById(req.params.userId);
  if(!user)
   return res.status(404).json({success:false,message:"User not found"});

  // Ban user
  user.isBanned = true;
  await user.save();

  //Gỡ toàn bộ tin
  await Post.updateMany(
   { userId:user._id },
   { status:"REMOVED" }
  );

  res.json({
   success:true,
   message:"User banned and all posts removed"
  });
 }catch(err){
  res.status(500).json({success:false,message:err.message});
 }
};
exports.unbanUser = async (req,res)=>{
 try{
  const user = await User.findById(req.params.userId);
  if(!user)
   return res.status(404).json({success:false,message:"User not found"});

  user.isBanned = false;
  await user.save();

  res.json({
   success:true,
   message:"User unbanned"
  });
 }catch(err){
  res.status(500).json({success:false,message:err.message});
 }
};
