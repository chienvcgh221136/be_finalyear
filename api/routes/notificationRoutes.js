const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middlewares/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

router.get("/", notificationController.getUserNotifications);
router.put("/:id/read", notificationController.markAsRead);
router.put("/mark-all-read", notificationController.markAllAsRead);

// Admin Routes
const roleMiddleware = require("../middlewares/roleMiddleware");
const adminAuth = roleMiddleware(['ADMIN']);

router.post("/admin/create", adminAuth, notificationController.createSystemNotification);
router.get("/admin/list", adminAuth, notificationController.getAllSystemNotifications);
router.put("/admin/:id", adminAuth, notificationController.updateNotification);
router.delete("/admin/:id", adminAuth, notificationController.deleteNotification);

module.exports = router;
