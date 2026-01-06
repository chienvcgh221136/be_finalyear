const mongoose=require("mongoose");

const PostSchema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 title:{type:String,required:true},
 description:{type:String},
 transactionType:{type:String,enum:["RENT","SALE"],required:true},
 propertyType:{type:String,enum:["ROOM","HOUSE","APARTMENT"],required:true},
 roomType:{type:String,enum:["MOTEL","MINI_APT"],default:null},
 price:{type:Number,required:true},
 deposit:{type:Number,default:0},
 area:{type:Number},
 district:{type:String},
 city:{type:String},
 bedrooms:{type:Number},
 bathrooms:{type:Number},
 images:[String],
 redbookImages:[String],
 status:{type:String,enum:["PENDING","ACTIVE","REJECTED","SOLD"],default:"PENDING"},
 
 rejectReason:{type:String,default:null},

 isVip:{type:Boolean,default:false},
 priorityScore:{type:Number,default:0},
 viewCount:{type:Number,default:0}
},{timestamps:true,collection:"posts"});

module.exports=mongoose.model("Post",PostSchema);
