/**
 * Unit tests for queue service
 */

const queueService = require('../src/services/queue.service');
const { pool } = require('../src/db');

describe('Queue Service', () => {
  let testDoctorId;
  let testPatientId;
  let testQueueId;
  
  beforeAll(async () => {
    // Create test doctor and patient
    const [doctorResult] = await pool.query(
      "INSERT INTO users (phone, name, role) VALUES ('09121111111', 'دکتر تست', 'doctor')"
    );
    testDoctorId = doctorResult.insertId;
    
    const [patientResult] = await pool.query(
      "INSERT INTO users (phone, name, role) VALUES ('09122222222', 'بیمار تست', 'patient')"
    );
    testPatientId = patientResult.insertId;
  });
  
  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM users WHERE id IN (?, ?)', [testDoctorId, testPatientId]);
    await pool.end();
  });
  
  test('should create queue for doctor and date', async () => {
    const date = '2025-11-15';
    const queue = await queueService.getOrCreateQueue(testDoctorId, date);
    
    expect(queue).toBeDefined();
    expect(queue.doctor_id).toBe(testDoctorId);
    expect(queue.date).toBe(date);
    
    testQueueId = queue.id;
  });
  
  test('should return existing queue if already created', async () => {
    const date = '2025-11-15';
    const queue = await queueService.getOrCreateQueue(testDoctorId, date);
    
    expect(queue.id).toBe(testQueueId);
  });
  
  test('should enqueue patient with correct position', async () => {
    const item = await queueService.enqueue({
      queueId: testQueueId,
      patientId: testPatientId,
      expectedDurationMinutes: 10
    });
    
    expect(item).toBeDefined();
    expect(item.position).toBe(1);
    expect(item.expected_duration_minutes).toBe(10);
    expect(item.status).toBe('waiting');
  });
  
  test('should calculate expected duration using weighted average', async () => {
    const conn = await pool.getConnection();
    try {
      const duration = await queueService.calculateExpectedDuration(
        testDoctorId,
        testPatientId,
        conn
      );
      
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe('number');
    } finally {
      conn.release();
    }
  });
  
  test('should maintain unique positions during concurrent enqueue', async () => {
    // Simulate 20 concurrent enqueues
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        queueService.enqueue({
          queueId: testQueueId,
          patientId: testPatientId,
          expectedDurationMinutes: 8
        })
      );
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    // Extract positions
    const positions = successful.map(r => r.value.position);
    const uniquePositions = new Set(positions);
    
    // All positions should be unique
    expect(uniquePositions.size).toBe(successful.length);
  });
  
  test('should recalculate ETAs correctly', async () => {
    const items = await queueService.getQueueWithItems(testQueueId);
    
    // Check that ETAs are monotonic (non-overlapping)
    for (let i = 1; i < items.length; i++) {
      const prevEnd = new Date(items[i - 1].estimated_end_at);
      const currentStart = new Date(items[i].estimated_start_at);
      
      expect(currentStart.getTime()).toBeGreaterThanOrEqual(prevEnd.getTime());
    }
  });
});
