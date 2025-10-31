const express = require('express');
const { attachUser, requireFullAuth, requireRole } = require('../middleware/auth');
const { listAllUsers, changeUserRole, removeUser } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/users', attachUser, requireFullAuth, requireRole('admin'), listAllUsers);
router.put('/users/:id/role', attachUser, requireFullAuth, requireRole('admin'), changeUserRole);
router.delete('/users/:id', attachUser, requireFullAuth, requireRole('admin'), removeUser);

module.exports = router;

