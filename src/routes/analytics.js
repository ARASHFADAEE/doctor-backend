const express = require('express');
const { attachUser, requireFullAuth } = require('../middleware/auth');
const { getTrend, getRecommendations, autoTagTest } = require('../controllers/analytics.controller');

const router = express.Router();

// Trend dashboard: monthly aggregates for the last N months
router.get('/trends/:metric', attachUser, requireFullAuth, getTrend);

// Smart recommendations for the current user
router.get('/recommendations', attachUser, requireFullAuth, getRecommendations);

// Smart tagging: infer and update extracted_tags for a test
router.post('/auto-tag/:id', attachUser, requireFullAuth, autoTagTest);

module.exports = router;
