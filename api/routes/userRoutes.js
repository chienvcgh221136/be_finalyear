const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/roleMiddleware");
const userController = require("../controllers/userController");

router.get("/", auth, checkRole(["ADMIN"]), userController.getAllUsers);
router.get("/me", auth, userController.getProfile);
router.put("/me", auth, userController.updateProfile);
router.get("/:id", auth, userController.getUserById);

// Block/Unblock routes
router.post("/block", auth, userController.blockUser);
router.post("/unblock", auth, userController.unblockUser);
router.get("/blocked/all", auth, userController.getBlockedUsers);

module.exports = router;
