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
  listOTPsAdmin,
};

async function listOTPsAdmin({ page = 1, pageSize = 50, phone = null }) {
  const offset = (page - 1) * pageSize;
  const params = [];
  let where = 'WHERE 1=1';
  if (phone) { where += ' AND phone = ?'; params.push(phone); }
  const [[tot]] = await pool.query(`SELECT COUNT(*) AS total FROM otp_codes ${where}`, params);
  const [rows] = await pool.query(
    `SELECT id, phone, code, used, expires_at, created_at
     FROM otp_codes
     ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  return { total: tot.total, items: rows };
}
