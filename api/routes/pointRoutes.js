const express = require("express");
const router = express.Router();
const pointController = require("../controllers/pointController");
const verifyToken = require("../middlewares/authMiddleware");

router.get("/me", verifyToken, pointController.getMyPoints);
router.get("/vip-items-history", verifyToken, pointController.getVipItemsUsageHistory);

// Admin Routes
router.get("/admin/logs", verifyToken, pointController.getAllPointLogs);
router.get("/admin/stats", verifyToken, pointController.getAdminPointStats);
router.get("/admin/users-points", verifyToken, pointController.getUsersWithPoints); // NEW
router.post("/admin/adjust-points", verifyToken, pointController.adjustUserPoints); // NEW

router.post("/redeem", verifyToken, pointController.redeemReward);
router.post("/use-item", verifyToken, pointController.useInventoryItem);

module.exports = router;
