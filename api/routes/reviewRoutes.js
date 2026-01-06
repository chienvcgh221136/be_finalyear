const router=require("express").Router();
const auth=require("../middlewares/authMiddleware");
const ctl=require("../controllers/reviewController");

router.post("/:postId",auth,ctl.createReview);
router.get("/seller/:sellerId",ctl.getSellerReviews);

module.exports=router;
