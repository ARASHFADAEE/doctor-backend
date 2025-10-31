const path = require('path');
const multer = require('multer');
const { analyzeImage } = require('../services/openai.service');
const { createTest, updateTest, listByDoctor, listByPatient, getById } = require('../models/MedicalTest');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `test_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

function isUrgentStructured(result) {
  if (!result) return false;
  if (typeof result === 'string') return /(فوری|urgent|اورژانسی|اورژانس)/i.test(result);
  return !!result.urgent || result.severity === 'high';
}

async function uploadAndAnalyze(req, res, next) {
  try {
    const file = req.file;
    const { description, doctor_id } = req.body;
    if (!file) return res.status(400).json({ success: false, message: 'تصویر الزامی است' });

    const imagePath = path.join('uploads', file.filename);
    const test = await createTest({ patient_id: req.user.id, doctor_id: doctor_id ? Number(doctor_id) : null, image_path: imagePath, description, status: 'pending' });

    const ai_result_obj = await analyzeImage({ imagePath: path.join(__dirname, '../../', imagePath), description, age: req.user.age });
    const status = isUrgentStructured(ai_result_obj) ? 'urgent' : 'processed';
    await updateTest(test.id, { status, ai_result: JSON.stringify(ai_result_obj) });

    return res.json({ test_id: test.id, status, result: ai_result_obj, is_urgent: status === 'urgent' });
  } catch (e) { next(e); }
}

async function doctorList(req, res, next) {
  try {
    const list = await listByDoctor(req.user.id);
    return res.json(list);
  } catch (e) { next(e); }
}

async function patientList(req, res, next) {
  try {
    if (req.user.role === 'doctor') {
      // برای دکترها لیست اختصاصی موجود است
      const list = await listByDoctor(req.user.id);
      return res.json(list);
    }
    const list = await listByPatient(req.user.id);
    return res.json(list);
  } catch (e) { next(e); }
}

async function getDetails(req, res, next) {
  try {
    const id = Number(req.params.id);
    const test = await getById(id);
    if (!test) return res.status(404).json({ success: false, message: 'تست یافت نشد' });
    // Access control: owner patient, assigned doctor, or admin
    if (!(req.user.role === 'admin' || req.user.id === test.patient_id || (req.user.role === 'doctor' && req.user.id === test.doctor_id))) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
    }
    return res.json(test);
  } catch (e) { next(e); }
}

module.exports = {
  upload,
  uploadAndAnalyze,
  doctorList,
  patientList,
  getDetails,
};
