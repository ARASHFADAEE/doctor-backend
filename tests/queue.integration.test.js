/**
 * Integration tests for queue API endpoints
 */

const request = require('supertest');
const express = require('express');
const queueRoutes = require('../src/routes/queue');
const { pool } = require('../src/db');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api', queueRoutes);

describe('Queue API Integration', () => {
  let doctorToken;
  let doctorId;
  let patientId;
  let queueId;
  let queueItemId;
  
  beforeAll(async () => {
    // Create test users
    const [doctorResult] = await pool.query(
      "INSERT INTO users (phone, name, role, is_verified) VALUES ('09123333333', 'دکتر API', 'doctor', true)"
    );
    doctorId = doctorResult.insertId;
    
    const [patientResult] = await pool.query(
      "INSERT INTO users (phone, name, role) VALUES ('09124444444', 'بیمار API', 'patient')"
    );
    patientId = patientResult.insertId;
    
    // Generate token
    doctorToken = jwt.sign(
      { sub: doctorId, type: 'full', role: 'doctor' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });
  
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id IN (?, ?)', [doctorId, patientId]);
    await pool.end();
  });
  
  test('POST /api/queues/:doctorId/date/:date - should create queue', async () => {
    const date = '2025-11-16';
    
    const res = await request(app)
      .post(`/api/queues/${doctorId}/date/${date}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.queue).toBeDefined();
    expect(res.body.queue.doctor_id).toBe(doctorId);
    
    queueId = res.body.queue.id;
  });
  
  test('GET /api/queues/:doctorId/date/:date - should get queue with items', async () => {
    const date = '2025-11-16';
    
    const res = await request(app)
      .get(`/api/queues/${doctorId}/date/${date}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.queue.items).toBeDefined();
    expect(Array.isArray(res.body.queue.items)).toBe(true);
  });
  
  test('POST /api/queues/:queueId/enqueue - should enqueue patient', async () => {
    const res = await request(app)
      .post(`/api/queues/${queueId}/enqueue`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patient_id: patientId,
        expected_duration_minutes: 10
      })
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.queue_item).toBeDefined();
    expect(res.body.queue_item.position).toBe(1);
    
    queueItemId = res.body.queue_item.id;
  });
  
  test('POST /api/queue-items/:id/start - should start queue item', async () => {
    const res = await request(app)
      .post(`/api/queue-items/${queueItemId}/start`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    
    expect(res.body.success).toBe(true);
  });
  
  test('POST /api/queue-items/:id/extend - should extend duration', async () => {
    const res = await request(app)
      .post(`/api/queue-items/${queueItemId}/extend`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        extra_minutes: 5,
        note: 'نیاز به زمان بیشتر'
      })
      .expect(200);
    
    expect(res.body.success).toBe(true);
  });
  
  test('POST /api/queue-items/:id/end - should end queue item', async () => {
    const res = await request(app)
      .post(`/api/queue-items/${queueItemId}/end`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.actual_duration).toBeDefined();
  });
  
  test('GET /api/doctors/:id/settings - should get doctor settings', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/settings`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.settings).toBeDefined();
    expect(res.body.settings.default_duration_minutes).toBeDefined();
  });
  
  test('PUT /api/doctors/:id/settings - should update settings', async () => {
    const res = await request(app)
      .put(`/api/doctors/${doctorId}/settings`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        default_duration_minutes: 12,
        buffer_after_minutes: 2
      })
      .expect(200);
    
    expect(res.body.success).toBe(true);
  });
});
