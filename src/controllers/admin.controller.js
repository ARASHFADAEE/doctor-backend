const { listUsers, updateRole, deleteUser } = require('../models/User');
const { pool } = require('../db');
const { getById, updateTest } = require('../models/MedicalTest');
const { normalizeAIResult } = require('../utils/aiResult');
const { listOTPsAdmin } = require('../models/OTP');

async function listAllUsers(req, res, next) {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (e) { next(e); }
}

async function changeUserRole(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;
    if (!['patient', 'doctor', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'نقش نامعتبر' });
    const user = await updateRole(id, role);
    res.json(user);
  } catch (e) { next(e); }
}

async function removeUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    await deleteUser(id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = {
  listAllUsers,
  changeUserRole,
  removeUser,
  health,
  overviewStats,
  timeseriesStats,
  trendingTags,
  listAllTests,
  getTestAdmin,
  updateTestAdmin,
  deleteTestAdmin,
  listOTPs,
};

async function health(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: rows[0]?.ok === 1, timestamp: new Date().toISOString() });
  } catch (e) { next(e); }
}

async function overviewStats(req, res, next) {
  try {
    const [[usersTotal]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [[patients]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='patient'");
    const [[doctors]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='doctor'");
    const [[admins]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='admin'");
    const [[testsTotal]] = await pool.query('SELECT COUNT(*) AS total FROM medical_tests');
    const [[pending]] = await pool.query("SELECT COUNT(*) AS total FROM medical_tests WHERE status='pending'");
    const [[processed]] = await pool.query("SELECT COUNT(*) AS total FROM medical_tests WHERE status='processed'");
    const [[urgent]] = await pool.query("SELECT COUNT(*) AS total FROM medical_tests WHERE status='urgent'");
    res.json({
      users: { total: usersTotal.total, patients: patients.total, doctors: doctors.total, admins: admins.total },
      tests: { total: testsTotal.total, pending: pending.total, processed: processed.total, urgent: urgent.total },
    });
  } catch (e) { next(e); }
}

async function timeseriesStats(req, res, next) {
  try {
    const days = Number(req.query.days || 30);
    const [rows] = await pool.query(
      `SELECT DATE(created_at) AS d,
              COUNT(*) AS total,
              SUM(status='urgent') AS urgent,
              SUM(status='processed') AS processed,
              SUM(status='pending') AS pending
       FROM medical_tests
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY d
       ORDER BY d ASC`,
      [days]
    );
    res.json(rows.map(r => ({ date: r.d, total: Number(r.total), urgent: Number(r.urgent), processed: Number(r.processed), pending: Number(r.pending) })));
  } catch (e) { next(e); }
}

async function trendingTags(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, ai_result, description FROM medical_tests WHERE ai_result IS NOT NULL ORDER BY created_at DESC LIMIT 500');
    const freq = new Map();
    for (const r of rows) {
      try {
        const ai = normalizeAIResult(r.ai_result, { description: r.description, age: null });
        for (const tag of ai.extracted_tags || []) {
          freq.set(tag, (freq.get(tag) || 0) + 1);
        }
      } catch (_) {}
    }
    const top = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([tag, count]) => ({ tag, count }));
    res.json(top);
  } catch (e) { next(e); }
}

async function listAllTests(req, res, next) {
  try {
    const { status, doctor_id, patient_id, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size || 20)));
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { where += ' AND mt.status = ?'; params.push(status); }
    if (doctor_id) { where += ' AND mt.doctor_id = ?'; params.push(Number(doctor_id)); }
    if (patient_id) { where += ' AND mt.patient_id = ?'; params.push(Number(patient_id)); }
    if (from) { where += ' AND mt.created_at >= ?'; params.push(from); }
    if (to) { where += ' AND mt.created_at <= ?'; params.push(to); }
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query(
      `SELECT mt.id, mt.description, mt.status, mt.created_at, mt.image_path, mt.ai_result,
              p.name AS patient_name, p.phone AS patient_phone,
              d.name AS doctor_name, d.phone AS doctor_phone
       FROM medical_tests mt
       JOIN users p ON mt.patient_id = p.id
       LEFT JOIN users d ON mt.doctor_id = d.id
       ${where}
       ORDER BY mt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const items = rows.map(r => {
      let severity = 'low'; let is_urgent = r.status === 'urgent';
      try {
        if (r.ai_result) {
          const ai = normalizeAIResult(r.ai_result, { description: r.description, age: null });
          severity = ai?.severity || severity;
          is_urgent = typeof ai?.urgent === 'boolean' ? ai.urgent : is_urgent;
        }
      } catch (_) {}
      return {
        id: r.id,
        description: r.description,
        status: r.status,
        severity,
        is_urgent,
        created_at: r.created_at,
        image_path: r.image_path,
        patient: { name: r.patient_name, phone: r.patient_phone },
        doctor: r.doctor_name ? { name: r.doctor_name, phone: r.doctor_phone } : null,
      };
    });
    res.json({ page, page_size: pageSize, items });
  } catch (e) { next(e); }
}

async function getTestAdmin(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT mt.*, p.name AS patient_name, p.phone AS patient_phone,
              d.name AS doctor_name, d.phone AS doctor_phone
       FROM medical_tests mt
       JOIN users p ON mt.patient_id = p.id
       LEFT JOIN users d ON mt.doctor_id = d.id
       WHERE mt.id = ?
       LIMIT 1`,
      [id]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ success: false, message: 'تست یافت نشد' });
    res.json({
      id: r.id,
      patient: { id: r.patient_id, name: r.patient_name, phone: r.patient_phone },
      doctor: r.doctor_id ? { id: r.doctor_id, name: r.doctor_name, phone: r.doctor_phone } : null,
      image_path: r.image_path,
      description: r.description,
      ai_result: r.ai_result,
      status: r.status,
      created_at: r.created_at,
    });
  } catch (e) { next(e); }
}

async function updateTestAdmin(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status, doctor_id } = req.body;
    const allowed = [undefined, 'pending', 'processed', 'urgent'];
    if (status && !allowed.includes(status)) return res.status(400).json({ success: false, message: 'وضعیت نامعتبر' });
    const updated = await updateTest(id, { status, doctor_id });
    res.json(updated);
  } catch (e) { next(e); }
}

async function deleteTestAdmin(req, res, next) {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM medical_tests WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function listOTPs(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.page_size || 50)));
    const phone = req.query.phone || null;
    const { items, total } = await listOTPsAdmin({ page, pageSize, phone });
    res.json({ page, page_size: pageSize, total, items });
  } catch (e) { next(e); }
}
