const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbotController");
const { chatbotRateLimiter } = require("../middlewares/rateLimitMiddleware");

router.post("/query", chatbotRateLimiter, chatbotController.handleQuery);

module.exports = router;
