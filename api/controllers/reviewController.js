const Review=require("../models/ReviewModel");
const Lead=require("../models/LeadModel");
const Appointment=require("../models/AppointmentModel");
const User=require("../models/UserModel");

exports.createReview=async(req,res)=>{
 try{
  const {rating,comment}=req.body;
  const postId=req.params.postId;
  const buyerId=req.user.userId;

  const lead=await Lead.findOne({postId,buyerId});
  const ap=await Appointment.findOne({postId,buyerId,status:"APPROVED"});
  if(!lead && !ap)
   return res.status(403).json({success:false,message:"No interaction"});

  const sellerId=lead?lead.sellerId:ap.sellerId;

  const rv=await Review.create({postId,buyerId,sellerId,rating,comment});

  const seller=await User.findById(sellerId);
  seller.rating=((seller.rating*seller.totalReviews)+rating)/(seller.totalReviews+1);
  seller.totalReviews+=1;
  await seller.save();

  res.json({success:true,data:rv});
 }catch(e){
  if(e.code===11000)
   return res.status(400).json({success:false,message:"Already reviewed"});
  res.status(500).json({success:false,message:e.message});
 }
};

exports.getSellerReviews=async(req,res)=>{
 const list=await Review.find({sellerId:req.params.sellerId})
  .populate("buyerId","name");
 res.json({success:true,data:list});
};
