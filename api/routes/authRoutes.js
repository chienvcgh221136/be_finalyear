const express = require("express");
const router = express.Router();
const {
    register,
    login,
    refreshToken,
    logout,
    googleLogin,
    forgotPasswordCheckEmail,
    forgotPasswordSendOTP,
    forgotPasswordVerifyOTP,
    resetPassword
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/google", googleLogin);

router.post("/forgot-password/check-email", forgotPasswordCheckEmail);
router.post("/forgot-password/send-otp", forgotPasswordSendOTP);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOTP);
router.post("/forgot-password/reset", resetPassword);

module.exports = router;

