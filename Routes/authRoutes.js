
const express = require('express');
const router = express.Router();
const authController = require('../Src/Auth/authController');
const { protect } = require('../Utils/auth');


// Public routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/me', protect, authController.getMe);

module.exports = router;