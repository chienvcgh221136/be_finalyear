const express=require("express");
const router=express.Router();
const leadController=require("../controllers/leadController");
const auth=require("../middlewares/authMiddleware");

// Xem số điện thoại người bán
router.post("/show-phone/:postId",auth,leadController.showPhone);

module.exports=router;
