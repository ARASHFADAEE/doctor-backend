const express = require('express');
const { getMe, updateMe } = require('../controllers/user.controller');
const { attachUser, requireFullAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', attachUser, requireFullAuth, getMe);
router.put('/me', attachUser, requireFullAuth, updateMe);

module.exports = router;

