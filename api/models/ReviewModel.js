const mongoose=require("mongoose");
const ReviewSchema=new mongoose.Schema({
 postId:{type:mongoose.Schema.Types.ObjectId,ref:"Post",required:true},
 buyerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 sellerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 rating:{type:Number,min:1,max:5,required:true},
 comment:String
},{timestamps:true});
ReviewSchema.index({postId:1,buyerId:1},{unique:true});
module.exports=mongoose.model("Review",ReviewSchema);