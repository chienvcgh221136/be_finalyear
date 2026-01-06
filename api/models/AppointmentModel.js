const mongoose=require("mongoose");
const AppointmentSchema=new mongoose.Schema({
 postId:{type:mongoose.Schema.Types.ObjectId,ref:"Post",required:true},
 buyerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 sellerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 appointmentTime:{type:Date,required:true},
 note:String,
 status:{type:String,enum:["PENDING","APPROVED","REJECTED","CANCELLED"],default:"PENDING"}
},{timestamps:true});
module.exports=mongoose.model("Appointment",AppointmentSchema);