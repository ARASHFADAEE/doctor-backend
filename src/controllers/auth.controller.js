const { validationResult, body } = require('express-validator');
const jwt = require('jsonwebtoken');
const { createOTP, findValidOTP, markUsed, countOTPSentInLastHour } = require('../models/OTP');
const { findByPhone, createUser } = require('../models/User');
const { sendOTP } = require('../services/sms.service');

const phoneValidator = body('phone')
  .isString()
  .trim()
  .matches(/^09\d{9}$/)
  .withMessage('فرمت موبایل نامعتبر است');

const sendOtpValidators = [phoneValidator];

async function sendOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { phone } = req.body;
    // Rate limit by phone
    const count = await countOTPSentInLastHour(phone);
    if (count >= 5) return res.status(429).json({ success: false, message: 'تعداد درخواست OTP بیش از حد مجاز' });

    const code = require('../utils/generateOTP')();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await createOTP(phone, code, expiresAt);
    await sendOTP(phone, code);
    return res.json({ success: true, message: 'کد تأیید ارسال شد', expires_in: 300 });
  } catch (e) {
    next(e);
  }
}

const verifyOtpValidators = [phoneValidator, body('code').isLength({ min: 4, max: 4 }).withMessage('کد نامعتبر است')];

async function verifyOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { phone, code } = req.body;
    const otp = await findValidOTP(phone, code);
    if (!otp) return res.status(400).json({ success: false, message: 'کد نامعتبر یا منقضی شده' });
    await markUsed(otp.id);

    const user = await findByPhone(phone);
    if (user) {
      const token = jwt.sign({ type: 'full', sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
      return res.json({ success: true, token, isNewUser: false, user: { id: user.id, phone: user.phone, role: user.role } });
    } else {
      // temp token for profile completion (10 minutes)
      const token = jwt.sign({ type: 'temp', phone }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ success: true, token, isNewUser: true, user: { phone, role: 'patient' } });
    }
  } catch (e) { next(e); }
}

const completeProfileValidators = [
  body('name').isString().isLength({ min: 2 }).withMessage('نام نامعتبر'),
  body('national_id').isLength({ min: 10, max: 10 }).withMessage('کدملی نامعتبر'),
  body('age').isInt({ min: 1, max: 120 }).withMessage('سن نامعتبر'),
];

async function completeProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const phone = req.tempUserPhone;
    if (!phone) return res.status(401).json({ success: false, message: 'توکن موقت نامعتبر' });
    const { name, national_id, age } = req.body;
    const user = await createUser({ phone, name, national_id, age, role: 'patient' });
    const token = jwt.sign({ type: 'full', sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
    return res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) { next(e); }
}

module.exports = {
  sendOtp,
  sendOtpValidators,
  verifyOtp,
  verifyOtpValidators,
  completeProfile,
  completeProfileValidators,
};

