const { pool } = require('../db');

async function findByPhone(phone) {
  const [rows] = await pool.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]);
  return rows[0] || null;
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function createUser({ phone, name, national_id, age, role = 'patient' }) {
  const [res] = await pool.query(
    'INSERT INTO users (phone, name, national_id, age, role, is_verified) VALUES (?, ?, ?, ?, ?, TRUE)',
    [phone, name, national_id, age, role]
  );
  return getById(res.insertId);
}

async function updateUser(id, { name, age, national_id }) {
  await pool.query(
    'UPDATE users SET name = COALESCE(?, name), age = COALESCE(?, age), national_id = COALESCE(?, national_id) WHERE id = ?',
    [name ?? null, age ?? null, national_id ?? null, id]
  );
  return getById(id);
}

async function listUsers() {
  const [rows] = await pool.query('SELECT id, phone, name, role, is_verified, created_at FROM users ORDER BY id DESC');
  return rows;
}

async function updateRole(id, role) {
  await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  return getById(id);
}

async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
}

module.exports = {
  findByPhone,
  getById,
  createUser,
  updateUser,
  listUsers,
  updateRole,
  deleteUser,
};

