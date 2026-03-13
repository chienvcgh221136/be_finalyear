const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbotController");
const { chatbotRateLimiter } = require("../middlewares/rateLimitMiddleware");
const { authenticate, optionalAuthenticate } = require("../middlewares/authMiddleware");

router.post("/query", chatbotRateLimiter, optionalAuthenticate, chatbotController.handleQuery);
router.get("/history", authenticate, chatbotController.getHistory);

module.exports = router;
