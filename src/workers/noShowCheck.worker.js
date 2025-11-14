/**
 * Worker: Check for no-show patients
 * Runs periodically to mark patients who didn't check in
 */

const { pool } = require('../db');

const NO_SHOW_THRESHOLD_MINUTES = 15; // Mark as no-show after 15 minutes

async function checkNoShows() {
  const conn = await pool.getConnection();
  try {
    console.log('[Worker] Checking for no-shows...');
    
    // Find appointments that are past scheduled time + threshold and still in 'scheduled' status
    const [appointments] = await conn.query(
      `SELECT a.id, a.patient_id, a.doctor_id, a.scheduled_time
       FROM appointments a
       WHERE a.status = 'scheduled'
       AND a.scheduled_time < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [NO_SHOW_THRESHOLD_MINUTES]
    );
    
    if (appointments.length === 0) {
      console.log('[Worker] No no-shows found');
      return;
    }
    
    // Update to no_show
    for (const appt of appointments) {
      await conn.query(
        `UPDATE appointments SET status = 'no_show', updated_at = NOW() WHERE id = ?`,
        [appt.id]
      );
      
      // Also update queue_items if exists
      await conn.query(
        `UPDATE queue_items SET status = 'skipped' WHERE appointment_id = ? AND status = 'waiting'`,
        [appt.id]
      );
      
      console.log(`[Worker] Marked appointment ${appt.id} as no-show`);
      
      // TODO: Send notification to patient (SMS/Push)
      // await smsService.send(patient.phone, 'شما نوبت خود را از دست دادید');
    }
    
    console.log(`[Worker] Marked ${appointments.length} appointments as no-show`);
  } catch (err) {
    console.error('[Worker] Error checking no-shows:', err);
  } finally {
    conn.release();
  }
}

// Run every 5 minutes
function startNoShowChecker() {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  setInterval(async () => {
    await checkNoShows();
  }, INTERVAL_MS);
  
  // Run immediately on start
  checkNoShows();
  
  console.log('[Worker] No-show checker started');
}

module.exports = { startNoShowChecker, checkNoShows };
