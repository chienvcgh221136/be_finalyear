const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const adminController = require("../controllers/adminController");

router.patch(
    "/users/:userId/ban",
    auth,
    role(["ADMIN"]),
    adminController.banUser
);
router.patch(
    "/users/:userId/unban",
    auth,
    role(["ADMIN"]),
    adminController.unbanUser
);

router.delete(
    "/users/:userId",
    auth,
    role(["ADMIN"]),
    adminController.deleteUser
);

module.exports = router;
