const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");

router.get("/", postController.getActivePosts);
router.get("/me/list", auth, postController.getMyPosts);
router.get("/user/:userId/list", postController.getPostsByUser);
router.get("/:id", auth, postController.getPostById);
router.post("/", auth, postController.createPost);
router.put("/:id", auth, postController.updatePost);
router.delete("/:id", auth, postController.deletePost);
router.patch("/:id/sold", auth, postController.markSold);
router.patch("/:id/rented", auth, postController.markRented);

router.get("/admin/pending", auth, role("ADMIN"), async (req, res) => {
    const posts = await require("../models/PostModel").find({ status: "PENDING" }).populate('userId', 'name email avatar phone');
    res.json({ success: true, data: posts });
});
router.patch("/:id/approve", auth, role("ADMIN"), postController.approvePost);
router.patch("/:id/reject", auth, role("ADMIN"), postController.rejectPost);

module.exports = router;
