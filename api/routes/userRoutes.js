const express = require("express");
const router = express.Router();
const auth=require("../middlewares/authMiddleware");
const userController = require("../controllers/userController");

router.get("/",auth, userController.getAllUsers);
router.get("/:id", auth, userController.getUserById);


module.exports = router;
