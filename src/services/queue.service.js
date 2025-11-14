const { pool } = require('../db');

/**
 * Queue Service - Core business logic for clinic queue management
 * Handles enqueue, dequeue, ETA calculations, and dynamic recalculation
 */

// Configuration weights for expected duration calculation
const DURATION_WEIGHTS = {
  default: 0.5,      // Doctor's default setting
  patient_avg: 0.3,  // Patient's historical average with this doctor
  doctor_avg: 0.2    // Doctor's overall average
};

/**
 * Get or create queue for a doctor on a specific date
 */
async function getOrCreateQueue(doctorId, date) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Try to get existing queue
    let [rows] = await conn.query(
      'SELECT * FROM doctor_queues WHERE doctor_id = ? AND date = ? FOR UPDATE',
      [doctorId, date]
    );
    
    if (rows.length > 0) {
      await conn.commit();
      return rows[0];
    }
    
    // Create new queue
    const [result] = await conn.query(
      'INSERT INTO doctor_queues (doctor_id, date) VALUES (?, ?)',
      [doctorId, date]
    );
    
    await conn.commit();
    return { id: result.insertId, doctor_id: doctorId, date };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Calculate expected duration using weighted average
 */
async function calculateExpectedDuration(doctorId, patientId, conn) {
  // Get doctor settings
  const [doctorSettings] = await conn.query(
    'SELECT default_duration_minutes FROM doctor_settings WHERE doctor_id = ?',
    [doctorId]
  );
  const defaultDuration = doctorSettings[0]?.default_duration_minutes || 8;
  
  // Get patient's historical average with this doctor
  const [patientAvg] = await conn.query(
    `SELECT AVG(duration_minutes) as avg_duration 
     FROM visit_durations 
     WHERE doctor_id = ? AND patient_id = ? 
     AND visit_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)`,
    [doctorId, patientId]
  );
  
  // Get doctor's overall average
  const [doctorAvg] = await conn.query(
    `SELECT AVG(duration_minutes) as avg_duration 
     FROM visit_durations 
     WHERE doctor_id = ? 
     AND visit_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`,
    [doctorId]
  );
  
  const patientAvgDuration = patientAvg[0]?.avg_duration || null;
  const doctorAvgDuration = doctorAvg[0]?.avg_duration || null;
  
  // Weighted calculation
  let expectedDuration = DURATION_WEIGHTS.default * defaultDuration;
  
  if (patientAvgDuration) {
    expectedDuration += DURATION_WEIGHTS.patient_avg * patientAvgDuration;
  } else {
    expectedDuration += DURATION_WEIGHTS.patient_avg * defaultDuration;
  }
  
  if (doctorAvgDuration) {
    expectedDuration += DURATION_WEIGHTS.doctor_avg * doctorAvgDuration;
  } else {
    expectedDuration += DURATION_WEIGHTS.doctor_avg * defaultDuration;
  }
  
  return Math.round(expectedDuration);
}

/**
 * Enqueue a patient - atomic operation with position locking
 */
async function enqueue({ queueId, patientId, appointmentId = null, expectedDurationMinutes = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get queue info
    const [queueRows] = await conn.query(
      'SELECT doctor_id FROM doctor_queues WHERE id = ?',
      [queueId]
    );
    if (queueRows.length === 0) throw new Error('صف یافت نشد');
    const doctorId = queueRows[0].doctor_id;
    
    // Lock and get max position
    const [posRows] = await conn.query(
      'SELECT COALESCE(MAX(position), 0) as max_pos FROM queue_items WHERE queue_id = ? FOR UPDATE',
      [queueId]
    );
    const newPosition = posRows[0].max_pos + 1;
    
    // Calculate expected duration if not provided
    let duration = expectedDurationMinutes;
    if (!duration) {
      duration = await calculateExpectedDuration(doctorId, patientId, conn);
    }
    
    // Insert queue item
    const [insertResult] = await conn.query(
      `INSERT INTO queue_items 
       (queue_id, appointment_id, patient_id, position, expected_duration_minutes, status) 
       VALUES (?, ?, ?, ?, ?, 'waiting')`,
      [queueId, appointmentId, patientId, newPosition, duration]
    );
    
    const queueItemId = insertResult.insertId;
    
    // Recalculate ETAs for all items
    await recalculateETAs(queueId, conn);
    
    await conn.commit();
    
    // Fetch and return the created item
    const [itemRows] = await conn.query(
      'SELECT * FROM queue_items WHERE id = ?',
      [queueItemId]
    );
    
    return itemRows[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Recalculate estimated start/end times for all items in queue
 */
async function recalculateETAs(queueId, conn = null) {
  const shouldRelease = !conn;
  if (!conn) conn = await pool.getConnection();
  
  try {
    // Get doctor settings for buffer
    const [queueInfo] = await conn.query(
      `SELECT dq.doctor_id, COALESCE(ds.buffer_after_minutes, 0) as buffer_after
       FROM doctor_queues dq
       LEFT JOIN doctor_settings ds ON dq.doctor_id = ds.doctor_id
       WHERE dq.id = ?`,
      [queueId]
    );
    
    if (queueInfo.length === 0) return;
    const bufferAfter = queueInfo[0].buffer_after;
    
    // Get all waiting and in_progress items sorted by position
    const [items] = await conn.query(
      `SELECT id, position, expected_duration_minutes, status, estimated_start_at
       FROM queue_items 
       WHERE queue_id = ? AND status IN ('waiting', 'in_progress')
       ORDER BY position ASC`,
      [queueId]
    );
    
    if (items.length === 0) return;
    
    let currentTime = new Date();
    
    // For first item
    let estimatedStart = currentTime;
    
    // If first item is in_progress, use its actual start
    if (items[0].status === 'in_progress' && items[0].estimated_start_at) {
      estimatedStart = new Date(items[0].estimated_start_at);
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (i > 0) {
        // Start time = previous end time
        const prevItem = items[i - 1];
        const prevEnd = new Date(prevItem.estimated_start_at);
        prevEnd.setMinutes(prevEnd.getMinutes() + prevItem.expected_duration_minutes + bufferAfter);
        estimatedStart = prevEnd;
      }
      
      const estimatedEnd = new Date(estimatedStart);
      estimatedEnd.setMinutes(estimatedEnd.getMinutes() + item.expected_duration_minutes);
      
      // Update item
      await conn.query(
        'UPDATE queue_items SET estimated_start_at = ?, estimated_end_at = ? WHERE id = ?',
        [estimatedStart, estimatedEnd, item.id]
      );
      
      // Prepare for next iteration
      items[i].estimated_start_at = estimatedStart;
    }
  } finally {
    if (shouldRelease) conn.release();
  }
}

/**
 * Start a queue item (patient enters room)
 */
async function startQueueItem(queueItemId, actorId, actorRole) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get item and update
    const [items] = await conn.query(
      'SELECT queue_id, status FROM queue_items WHERE id = ? FOR UPDATE',
      [queueItemId]
    );
    
    if (items.length === 0) throw new Error('آیتم صف یافت نشد');
    if (items[0].status !== 'waiting') throw new Error('وضعیت نامعتبر برای شروع');
    
    const queueId = items[0].queue_id;
    const now = new Date();
    
    // Update to in_progress
    await conn.query(
      `UPDATE queue_items 
       SET status = 'in_progress', estimated_start_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [now, queueItemId]
    );
    
    // Update appointment if exists
    await conn.query(
      `UPDATE appointments 
       SET status = 'in_room', actual_start_at = ? 
       WHERE id = (SELECT appointment_id FROM queue_items WHERE id = ?)`,
      [now, queueItemId]
    );
    
    // Log event
    await conn.query(
      `INSERT INTO queue_events (queue_item_id, event_type, actor, actor_id, timestamp)
       VALUES (?, 'start', ?, ?, ?)`,
      [queueItemId, actorRole, actorId, now]
    );
    
    // Recalculate ETAs
    await recalculateETAs(queueId, conn);
    
    await conn.commit();
    
    return { success: true, queueId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * End a queue item (visit completed)
 */
async function endQueueItem(queueItemId, actorId, actorRole, actualEndAt = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const [items] = await conn.query(
      `SELECT qi.queue_id, qi.patient_id, qi.expected_duration_minutes, 
              qi.estimated_start_at, dq.doctor_id, a.id as appointment_id
       FROM queue_items qi
       JOIN doctor_queues dq ON qi.queue_id = dq.id
       LEFT JOIN appointments a ON qi.appointment_id = a.id
       WHERE qi.id = ? FOR UPDATE`,
      [queueItemId]
    );
    
    if (items.length === 0) throw new Error('آیتم صف یافت نشد');
    
    const item = items[0];
    const queueId = item.queue_id;
    const endTime = actualEndAt ? new Date(actualEndAt) : new Date();
    
    // Calculate actual duration
    const startTime = new Date(item.estimated_start_at);
    const actualDuration = Math.round((endTime - startTime) / 60000); // minutes
    
    // Update queue item
    await conn.query(
      `UPDATE queue_items 
       SET status = 'done', estimated_end_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [endTime, queueItemId]
    );
    
    // Update appointment
    if (item.appointment_id) {
      await conn.query(
        `UPDATE appointments 
         SET status = 'completed', actual_end_at = ? 
         WHERE id = ?`,
        [endTime, item.appointment_id]
      );
    }
    
    // Log event
    await conn.query(
      `INSERT INTO queue_events (queue_item_id, event_type, actor, actor_id, timestamp, metadata)
       VALUES (?, 'end', ?, ?, ?, ?)`,
      [queueItemId, actorRole, actorId, endTime, JSON.stringify({ actual_duration: actualDuration })]
    );
    
    // Store duration for analytics
    await conn.query(
      `INSERT INTO visit_durations (doctor_id, patient_id, appointment_id, duration_minutes, visit_date)
       VALUES (?, ?, ?, ?, CURDATE())`,
      [item.doctor_id, item.patient_id, item.appointment_id, actualDuration]
    );
    
    // Recalculate ETAs
    await recalculateETAs(queueId, conn);
    
    await conn.commit();
    
    return { success: true, queueId, actualDuration };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Extend queue item duration
 */
async function extendQueueItem(queueItemId, extraMinutes, actorId, actorRole, note = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const [items] = await conn.query(
      'SELECT queue_id, expected_duration_minutes FROM queue_items WHERE id = ? FOR UPDATE',
      [queueItemId]
    );
    
    if (items.length === 0) throw new Error('آیتم صف یافت نشد');
    
    const queueId = items[0].queue_id;
    const newDuration = items[0].expected_duration_minutes + extraMinutes;
    
    await conn.query(
      'UPDATE queue_items SET expected_duration_minutes = ? WHERE id = ?',
      [newDuration, queueItemId]
    );
    
    await conn.query(
      `INSERT INTO queue_events (queue_item_id, event_type, actor, actor_id, note, metadata)
       VALUES (?, 'extend', ?, ?, ?, ?)`,
      [queueItemId, actorRole, actorId, note, JSON.stringify({ extra_minutes: extraMinutes })]
    );
    
    await recalculateETAs(queueId, conn);
    
    await conn.commit();
    
    return { success: true, queueId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Reposition queue item (manual reordering)
 */
async function repositionQueueItem(queueId, queueItemId, newPosition) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get current position
    const [items] = await conn.query(
      'SELECT position FROM queue_items WHERE id = ? AND queue_id = ? FOR UPDATE',
      [queueItemId, queueId]
    );
    
    if (items.length === 0) throw new Error('آیتم صف یافت نشد');
    const oldPosition = items[0].position;
    
    if (oldPosition === newPosition) {
      await conn.commit();
      return { success: true };
    }
    
    // Lock all items in queue
    await conn.query(
      'SELECT id FROM queue_items WHERE queue_id = ? FOR UPDATE',
      [queueId]
    );
    
    // Shift positions
    if (newPosition < oldPosition) {
      // Moving up - shift others down
      await conn.query(
        'UPDATE queue_items SET position = position + 1 WHERE queue_id = ? AND position >= ? AND position < ?',
        [queueId, newPosition, oldPosition]
      );
    } else {
      // Moving down - shift others up
      await conn.query(
        'UPDATE queue_items SET position = position - 1 WHERE queue_id = ? AND position > ? AND position <= ?',
        [queueId, oldPosition, newPosition]
      );
    }
    
    // Update target item
    await conn.query(
      'UPDATE queue_items SET position = ? WHERE id = ?',
      [newPosition, queueItemId]
    );
    
    // Log event
    await conn.query(
      `INSERT INTO queue_events (queue_item_id, event_type, actor, metadata)
       VALUES (?, 'reposition', 'system', ?)`,
      [queueItemId, JSON.stringify({ old_position: oldPosition, new_position: newPosition })]
    );
    
    await recalculateETAs(queueId, conn);
    
    await conn.commit();
    
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get full queue with all items and estimates
 */
async function getQueueWithItems(queueId) {
  const [items] = await pool.query(
    `SELECT qi.*, u.name as patient_name, u.phone as patient_phone,
            a.scheduled_time, a.status as appointment_status
     FROM queue_items qi
     JOIN users u ON qi.patient_id = u.id
     LEFT JOIN appointments a ON qi.appointment_id = a.id
     WHERE qi.queue_id = ?
     ORDER BY qi.position ASC`,
    [queueId]
  );
  
  return items;
}

/**
 * Get doctor settings or create default
 */
async function getDoctorSettings(doctorId) {
  const [rows] = await pool.query(
    'SELECT * FROM doctor_settings WHERE doctor_id = ?',
    [doctorId]
  );
  
  if (rows.length > 0) return rows[0];
  
  // Create default settings
  await pool.query(
    'INSERT INTO doctor_settings (doctor_id) VALUES (?)',
    [doctorId]
  );
  
  return {
    doctor_id: doctorId,
    default_duration_minutes: 8,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    allow_overflow: false
  };
}

/**
 * Update doctor settings
 */
async function updateDoctorSettings(doctorId, settings) {
  const fields = [];
  const values = [];
  
  if (settings.default_duration_minutes !== undefined) {
    fields.push('default_duration_minutes = ?');
    values.push(settings.default_duration_minutes);
  }
  if (settings.buffer_before_minutes !== undefined) {
    fields.push('buffer_before_minutes = ?');
    values.push(settings.buffer_before_minutes);
  }
  if (settings.buffer_after_minutes !== undefined) {
    fields.push('buffer_after_minutes = ?');
    values.push(settings.buffer_after_minutes);
  }
  if (settings.allow_overflow !== undefined) {
    fields.push('allow_overflow = ?');
    values.push(settings.allow_overflow);
  }
  
  if (fields.length === 0) return;
  
  values.push(doctorId);
  
  await pool.query(
    `UPDATE doctor_settings SET ${fields.join(', ')}, updated_at = NOW() WHERE doctor_id = ?`,
    values
  );
}

module.exports = {
  getOrCreateQueue,
  enqueue,
  startQueueItem,
  endQueueItem,
  extendQueueItem,
  repositionQueueItem,
  getQueueWithItems,
  recalculateETAs,
  getDoctorSettings,
  updateDoctorSettings,
  calculateExpectedDuration
};
