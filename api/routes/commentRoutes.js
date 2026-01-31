const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const commentController = require("../controllers/commentController");

router.get("/:postId", commentController.getCommentsByPost);
router.post("/:postId", auth, commentController.createComment);
router.delete("/:id", auth, commentController.deleteComment);

module.exports = router;
