module.exports = function generateOTP() {
  // تولید کد ۴ رقمی بین 1000 و 9999
  return String(Math.floor(Math.random() * 9000) + 1000);
};
