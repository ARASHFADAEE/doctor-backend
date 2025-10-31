const express = require('express');
const { attachUser, requireFullAuth, requireRole } = require('../middleware/auth');
const {
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
} = require('../controllers/admin.controller');

const router = express.Router();

router.get('/users', attachUser, requireFullAuth, requireRole('admin'), listAllUsers);
router.put('/users/:id/role', attachUser, requireFullAuth, requireRole('admin'), changeUserRole);
router.delete('/users/:id', attachUser, requireFullAuth, requireRole('admin'), removeUser);

// Health
router.get('/health', attachUser, requireFullAuth, requireRole('admin'), health);

// Stats & Reports
router.get('/stats/overview', attachUser, requireFullAuth, requireRole('admin'), overviewStats);
router.get('/stats/timeseries', attachUser, requireFullAuth, requireRole('admin'), timeseriesStats);
router.get('/stats/tags', attachUser, requireFullAuth, requireRole('admin'), trendingTags);

// Tests management
router.get('/tests', attachUser, requireFullAuth, requireRole('admin'), listAllTests);
router.get('/tests/:id', attachUser, requireFullAuth, requireRole('admin'), getTestAdmin);
router.put('/tests/:id', attachUser, requireFullAuth, requireRole('admin'), updateTestAdmin);
router.delete('/tests/:id', attachUser, requireFullAuth, requireRole('admin'), deleteTestAdmin);

// OTP monitoring
router.get('/otp-codes', attachUser, requireFullAuth, requireRole('admin'), listOTPs);

module.exports = router;
