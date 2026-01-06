const Favorite=require("../models/FavoriteModel");

exports.toggleFavorite=async(req,res)=>{
 try{
  const {postId}=req.params;
  const userId=req.user.userId;

  const exist=await Favorite.findOne({userId,postId});
  if(exist){
   await exist.deleteOne();
   return res.json({success:true,message:"Unfavorited"});
  }

  await Favorite.create({userId,postId});
  res.json({success:true,message:"Favorited"});
 }catch(e){
  res.status(500).json({success:false,message:e.message});
 }
};

exports.myFavorites=async(req,res)=>{
 const list=await Favorite.find({userId:req.user.userId})
  .populate("postId","title price images");
 res.json({success:true,data:list});
};

module.exports=exports;