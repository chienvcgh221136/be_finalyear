const Appointment=require("../models/AppointmentModel");
const Post=require("../models/PostModel");

exports.createAppointment=async(req,res)=>{
 try{
  const {appointmentTime,note}=req.body;
  const post=await Post.findById(req.params.postId);
  if(!post) return res.status(404).json({success:false,message:"Post not found"});

  const ap=await Appointment.create({
   postId:post._id,
   buyerId:req.user.userId,
   sellerId:post.userId,
   appointmentTime,
   note
  });

  res.json({success:true,data:ap});
 }catch(e){res.status(500).json({success:false,message:e.message});}
};

exports.updateStatus=async(req,res)=>{
 try{
  const ap=await Appointment.findById(req.params.id);
  if(!ap) return res.status(404).json({success:false,message:"Not found"});
  if(ap.sellerId.toString()!==req.user.userId)
   return res.status(403).json({success:false,message:"Forbidden"});

  ap.status=req.body.status;
  await ap.save();
  res.json({success:true,data:ap});
 }catch(e){res.status(500).json({success:false,message:e.message});}
};

exports.myAppointments=async(req,res)=>{
 const list=await Appointment.find({buyerId:req.user.userId})
  .populate("postId","title");
 res.json({success:true,data:list});
};
