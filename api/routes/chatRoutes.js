const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authenticateUser = require("../middlewares/authMiddleware");

// Apply auth middleware to all routes
router.use(authenticateUser);

router.post("/create", chatController.createOrGetChat);
router.get("/my-chats", chatController.getMyChats);
router.get("/:chatRoomId/messages", chatController.getMessages);
router.post("/:chatRoomId/send", chatController.sendMessage);
router.put("/:chatRoomId/read", chatController.markAsRead);

module.exports = router;
