const express = require('express');
const { attachUser, requireFullAuth, requireRole } = require('../middleware/auth');
const { upload, uploadAndAnalyze, doctorList, patientList, getDetails } = require('../controllers/test.controller');

const router = express.Router();

// Upload & analyze
router.post('/upload', attachUser, requireFullAuth, upload.single('image'), uploadAndAnalyze);

// Patient list (and convenience for doctors)
router.get('/', attachUser, requireFullAuth, patientList);

// Doctor list
router.get('/doctor', attachUser, requireFullAuth, requireRole('doctor'), doctorList);

// Details
router.get('/:id', attachUser, requireFullAuth, getDetails);

module.exports = router;
