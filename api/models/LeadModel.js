const mongoose=require("mongoose");

const LeadSchema=new mongoose.Schema({
 postId:{type:mongoose.Schema.Types.ObjectId,ref:"Post",required:true},
 buyerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 sellerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 type:{type:String,enum:["SHOW_PHONE"],required:true}
},{timestamps:true});


module.exports=mongoose.model("Lead",LeadSchema);
