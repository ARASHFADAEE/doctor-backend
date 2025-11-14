const queueService = require('../services/queue.service');

/**
 * Create or get queue for doctor on specific date
 * POST /api/queues/:doctorId/date/:date
 */
async function createOrGetQueue(req, res, next) {
  try {
    const { doctorId, date } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'فرمت تاریخ نامعتبر است' });
    }
    
    const queue = await queueService.getOrCreateQueue(doctorId, date);
    
    res.json({ success: true, queue });
  } catch (err) {
    next(err);
  }
}

/**
 * Get queue with all items
 * GET /api/queues/:doctorId/date/:date
 */
async function getQueue(req, res, next) {
  try {
    const { doctorId, date } = req.params;
    
    const queue = await queueService.getOrCreateQueue(doctorId, date);
    const items = await queueService.getQueueWithItems(queue.id);
    
    res.json({ 
      success: true, 
      queue: {
        ...queue,
        items
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Enqueue a patient
 * POST /api/queues/:queueId/enqueue
 * Body: { patient_id, appointment_id?, expected_duration_minutes? }
 */
async function enqueuePatient(req, res, next) {
  try {
    const { queueId } = req.params;
    const { patient_id, appointment_id, expected_duration_minutes } = req.body;
    
    if (!patient_id) {
      return res.status(400).json({ success: false, message: 'شناسه بیمار الزامی است' });
    }
    
    const queueItem = await queueService.enqueue({
      queueId,
      patientId: patient_id,
      appointmentId: appointment_id,
      expectedDurationMinutes: expected_duration_minutes
    });
    
    // Emit socket event (will be handled by socket handler)
    if (req.app.io) {
      const items = await queueService.getQueueWithItems(queueId);
      req.app.io.to(`queue:${queueId}`).emit('queue.update', { queueId, items });
    }
    
    res.json({ success: true, queue_item: queueItem });
  } catch (err) {
    next(err);
  }
}

/**
 * Start queue item (patient enters room)
 * POST /api/queue-items/:id/start
 */
async function startItem(req, res, next) {
  try {
    const { id } = req.params;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    
    const result = await queueService.startQueueItem(id, actorId, actorRole);
    
    // Emit socket events
    if (req.app.io) {
      const items = await queueService.getQueueWithItems(result.queueId);
      req.app.io.to(`queue:${result.queueId}`).emit('queue.update', { queueId: result.queueId, items });
      req.app.io.to(`queue:${result.queueId}`).emit('queue.item.started', { queueItemId: id });
    }
    
    res.json({ success: true, message: 'ویزیت شروع شد' });
  } catch (err) {
    next(err);
  }
}

/**
 * End queue item (visit completed)
 * POST /api/queue-items/:id/end
 */
async function endItem(req, res, next) {
  try {
    const { id } = req.params;
    const { actual_end_at } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    
    const result = await queueService.endQueueItem(id, actorId, actorRole, actual_end_at);
    
    // Emit socket events
    if (req.app.io) {
      const items = await queueService.getQueueWithItems(result.queueId);
      req.app.io.to(`queue:${result.queueId}`).emit('queue.update', { queueId: result.queueId, items });
      req.app.io.to(`queue:${result.queueId}`).emit('queue.item.ended', { 
        queueItemId: id, 
        actualDuration: result.actualDuration 
      });
    }
    
    res.json({ success: true, message: 'ویزیت پایان یافت', actual_duration: result.actualDuration });
  } catch (err) {
    next(err);
  }
}

/**
 * Extend queue item duration
 * POST /api/queue-items/:id/extend
 */
async function extendItem(req, res, next) {
  try {
    const { id } = req.params;
    const { extra_minutes, note } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    
    if (!extra_minutes || extra_minutes <= 0) {
      return res.status(400).json({ success: false, message: 'مدت زمان اضافی نامعتبر است' });
    }
    
    const result = await queueService.extendQueueItem(id, extra_minutes, actorId, actorRole, note);
    
    // Emit socket event
    if (req.app.io) {
      const items = await queueService.getQueueWithItems(result.queueId);
      req.app.io.to(`queue:${result.queueId}`).emit('queue.update', { queueId: result.queueId, items });
      req.app.io.to(`queue:${result.queueId}`).emit('queue.estimated_change', { 
        queueId: result.queueId,
        affected_items: items.filter(i => i.status === 'waiting')
      });
    }
    
    res.json({ success: true, message: 'زمان ویزیت افزایش یافت' });
  } catch (err) {
    next(err);
  }
}

/**
 * Reposition queue item
 * POST /api/queues/:queueId/position
 * Body: { queue_item_id, new_position }
 */
async function repositionItem(req, res, next) {
  try {
    const { queueId } = req.params;
    const { queue_item_id, new_position } = req.body;
    
    if (!queue_item_id || !new_position || new_position < 1) {
      return res.status(400).json({ success: false, message: 'پارامترهای نامعتبر' });
    }
    
    await queueService.repositionQueueItem(queueId, queue_item_id, new_position);
    
    // Emit socket event
    if (req.app.io) {
      const items = await queueService.getQueueWithItems(queueId);
      req.app.io.to(`queue:${queueId}`).emit('queue.update', { queueId, items });
    }
    
    res.json({ success: true, message: 'موقعیت تغییر یافت' });
  } catch (err) {
    next(err);
  }
}

/**
 * Get doctor settings
 * GET /api/doctors/:id/settings
 */
async function getDoctorSettings(req, res, next) {
  try {
    const { id } = req.params;
    
    const settings = await queueService.getDoctorSettings(id);
    
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

/**
 * Update doctor settings
 * PUT /api/doctors/:id/settings
 */
async function updateDoctorSettings(req, res, next) {
  try {
    const { id } = req.params;
    const settings = req.body;
    
    await queueService.updateDoctorSettings(id, settings);
    
    res.json({ success: true, message: 'تنظیمات به‌روزرسانی شد' });
  } catch (err) {
    next(err);
  }
}

/**
 * Get today's queue for doctor (convenience endpoint)
 * GET /api/doctor/:id/queue/today
 */
async function getDoctorQueueToday(req, res, next) {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const queue = await queueService.getOrCreateQueue(id, today);
    const items = await queueService.getQueueWithItems(queue.id);
    
    res.json({ 
      success: true, 
      queue: {
        ...queue,
        items
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrGetQueue,
  getQueue,
  enqueuePatient,
  startItem,
  endItem,
  extendItem,
  repositionItem,
  getDoctorSettings,
  updateDoctorSettings,
  getDoctorQueueToday
};
