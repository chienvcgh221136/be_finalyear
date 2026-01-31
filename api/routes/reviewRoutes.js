const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const ctl = require("../controllers/reviewController");

router.post("/:postId", auth, ctl.createReview);
router.get("/seller/:sellerId", ctl.getSellerReviews);
router.get("/post/:postId", ctl.getReviewsByPost);
router.delete("/:id", auth, ctl.deleteReview);
router.put("/:id", auth, ctl.updateReview);

module.exports = router;
