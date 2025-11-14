const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');
const { attachUser, requireFullAuth, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(attachUser);
router.use(requireFullAuth);

// Queue management - accessible by doctor, reception, admin
const queueAccess = (req, res, next) => {
  if (['doctor', 'admin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
};

// Create or get queue for specific date
router.post('/queues/:doctorId/date/:date', queueAccess, queueController.createOrGetQueue);

// Get queue with items
router.get('/queues/:doctorId/date/:date', queueAccess, queueController.getQueue);

// Enqueue patient
router.post('/queues/:queueId/enqueue', queueAccess, queueController.enqueuePatient);

// Queue item operations
router.post('/queue-items/:id/start', queueAccess, queueController.startItem);
router.post('/queue-items/:id/end', queueAccess, queueController.endItem);
router.post('/queue-items/:id/extend', queueAccess, queueController.extendItem);

// Reposition
router.post('/queues/:queueId/position', queueAccess, queueController.repositionItem);

// Doctor settings
router.get('/doctors/:id/settings', queueAccess, queueController.getDoctorSettings);
router.put('/doctors/:id/settings', requireRole('doctor'), queueController.updateDoctorSettings);

// Convenience endpoint - today's queue
router.get('/doctor/:id/queue/today', queueAccess, queueController.getDoctorQueueToday);

module.exports = router;
