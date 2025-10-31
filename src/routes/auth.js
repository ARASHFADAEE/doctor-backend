const express = require('express');
const { sendOtp, sendOtpValidators, verifyOtp, verifyOtpValidators, completeProfile, completeProfileValidators } = require('../controllers/auth.controller');
const { attachUser, requireTempAuth } = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

router.post('/send-otp', sendOtpValidators, sendOtp);
router.post('/verify-otp', verifyOtpValidators, verifyOtp);
router.post('/complete-profile', attachUser, requireTempAuth, completeProfileValidators, completeProfile);

module.exports = router;

