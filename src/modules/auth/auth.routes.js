const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const AuthController = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many signup attempts. Please try again later." }
});
const verificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many verification requests. Please try again later." }
});
const resendVerificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many resend requests. Please try again later." }
});

router.post("/signup", signupRateLimit, (req, res) => AuthController.signup(req, res));
router.post("/login", (req, res) => AuthController.login(req, res));
router.post("/verify-email", verificationRateLimit, (req, res) => AuthController.verifyEmail(req, res));
router.post("/resend-verification", resendVerificationRateLimit, (req, res) => AuthController.resendVerificationEmail(req, res));
router.post("/google", (req, res) => AuthController.googleLogin(req, res));
router.get("/me", authMiddleware, (req, res) => AuthController.me(req, res));
router.get("/stats", authMiddleware, (req, res) => AuthController.getStats(req, res));
router.put("/profile", authMiddleware, (req, res) => AuthController.updateProfile(req, res));
router.put("/password", authMiddleware, (req, res) => AuthController.changePassword(req, res));

module.exports = router;