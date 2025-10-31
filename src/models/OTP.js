const { pool } = require('../db');

async function createOTP(phone, code, expiresAt) {
  const [res] = await pool.query(
    'INSERT INTO otp_codes (phone, code, expires_at, used) VALUES (?, ?, ?, FALSE)',
    [phone, code, expiresAt]
  );
  return res.insertId;
}

async function findValidOTP(phone, code) {
  const [rows] = await pool.query(
    'SELECT * FROM otp_codes WHERE phone = ? AND code = ? AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
    [phone, code]
  );
  return rows[0] || null;
}

async function markUsed(id) {
  await pool.query('UPDATE otp_codes SET used = TRUE WHERE id = ?', [id]);
}

async function countOTPSentInLastHour(phone) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) as cnt FROM otp_codes WHERE phone = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
    [phone]
  );
  return rows[0].cnt || 0;
}

module.exports = {
  createOTP,
  findValidOTP,
  markUsed,
  countOTPSentInLastHour,
};

