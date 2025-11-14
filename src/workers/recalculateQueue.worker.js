/**
 * Worker: Recalculate queue ETAs (debounced)
 * Triggered after start/end/extend events
 */

const queueService = require('../services/queue.service');

// Simple in-memory debounce (for single instance)
// For multi-instance, use Redis-based debouncing
const pendingRecalculations = new Map();
const DEBOUNCE_MS = 500;

async function scheduleRecalculation(queueId) {
  // Clear existing timeout
  if (pendingRecalculations.has(queueId)) {
    clearTimeout(pendingRecalculations.get(queueId));
  }
  
  // Schedule new recalculation
  const timeoutId = setTimeout(async () => {
    try {
      console.log(`[Worker] Recalculating queue ${queueId}`);
      await queueService.recalculateETAs(queueId);
      pendingRecalculations.delete(queueId);
    } catch (err) {
      console.error(`[Worker] Error recalculating queue ${queueId}:`, err);
    }
  }, DEBOUNCE_MS);
  
  pendingRecalculations.set(queueId, timeoutId);
}

module.exports = { scheduleRecalculation };
