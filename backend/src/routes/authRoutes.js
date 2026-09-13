const express = require("express");
const {
  register,
  sendOtp,
  verifyOtpRegister,
  verifyOtpLogin,
  sendGoogleEmailLoginOtp,
  verifyEmailLoginOtp,
  selectRole,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");


const router = express.Router();

router.post("/register", register);
router.post("/otp/send", sendOtp);
router.post("/otp/verify-register", verifyOtpRegister);
router.post("/otp/verify-login", verifyOtpLogin);
router.post("/email-otp/google/send", sendGoogleEmailLoginOtp);
router.post("/email-otp/verify-login", verifyEmailLoginOtp);
router.post("/select-role", protect, selectRole);

module.exports = router;
