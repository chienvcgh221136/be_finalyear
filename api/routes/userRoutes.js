const express = require("express");
const router = express.Router();
const auth=require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/roleMiddleware");
const userController = require("../controllers/userController");

router.get("/", auth, checkRole(["ADMIN"]), userController.getAllUsers);
router.get("/profile", auth, userController.getProfile);
router.get("/:id", auth, userController.getUserById);


module.exports = router;
