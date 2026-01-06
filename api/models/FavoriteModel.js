const mongoose=require("mongoose");
const FavoriteSchema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 postId:{type:mongoose.Schema.Types.ObjectId,ref:"Post",required:true}
},{timestamps:true});
FavoriteSchema.index({userId:1,postId:1},{unique:true});

module.exports=mongoose.model("Favorite",FavoriteSchema);
