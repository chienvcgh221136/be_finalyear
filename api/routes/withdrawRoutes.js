const express = require("express");
const router = express.Router();
const withdrawController = require("../controllers/withdrawController");
const authenticateUser = require("../middlewares/authMiddleware");

// Apply auth middleware
router.use(authenticateUser);

// User Routes
router.post("/request", withdrawController.initiateWithdraw);
router.post("/verify", withdrawController.verifyWithdraw);

// Admin Routes (Should authenticate Admin role ideally)
router.get("/admin/requests", withdrawController.getWithdrawRequests);
router.put("/admin/request/:id", withdrawController.updateWithdrawStatus);

module.exports = router;
