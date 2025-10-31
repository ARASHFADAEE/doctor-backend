const { pool } = require('../db');

async function createTest({ patient_id, doctor_id, image_path, description, status = 'pending', ai_result = null }) {
  const [res] = await pool.query(
    'INSERT INTO medical_tests (patient_id, doctor_id, image_path, description, status, ai_result) VALUES (?, ?, ?, ?, ?, ?)',
    [patient_id, doctor_id ?? null, image_path, description ?? null, status, ai_result]
  );
  return getById(res.insertId);
}

async function updateTest(id, { status, ai_result, doctor_id }) {
  await pool.query(
    'UPDATE medical_tests SET status = COALESCE(?, status), ai_result = COALESCE(?, ai_result), doctor_id = COALESCE(?, doctor_id) WHERE id = ?',
    [status ?? null, ai_result ?? null, doctor_id ?? null, id]
  );
  return getById(id);
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM medical_tests WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listByDoctor(doctor_id) {
  const [rows] = await pool.query(
    `SELECT mt.id, mt.description, mt.status, mt.created_at,
            u.name as patient_name
     FROM medical_tests mt
     JOIN users u ON mt.patient_id = u.id
     WHERE mt.doctor_id = ?
     ORDER BY mt.created_at DESC`,
    [doctor_id]
  );
  return rows.map(r => ({ id: r.id, description: r.description, status: r.status, created_at: r.created_at, patient: { name: r.patient_name } }));
}

async function listByPatient(patient_id) {
  const [rows] = await pool.query(
    `SELECT mt.id, mt.description, mt.status, mt.created_at, mt.image_path,
            d.name as doctor_name
     FROM medical_tests mt
     LEFT JOIN users d ON mt.doctor_id = d.id
     WHERE mt.patient_id = ?
     ORDER BY mt.created_at DESC`,
    [patient_id]
  );
  return rows.map(r => ({ id: r.id, description: r.description, status: r.status, created_at: r.created_at, image_path: r.image_path, doctor: r.doctor_name ? { name: r.doctor_name } : null }));
}

module.exports = {
  createTest,
  updateTest,
  getById,
  listByDoctor,
  listByPatient,
};
