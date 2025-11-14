/**
 * مثال استفاده از Queue API و WebSocket
 * این فایل نمونه‌ای از نحوه استفاده از سیستم صف در کلاینت است
 */

const io = require('socket.io-client');

// تنظیمات
const API_URL = 'http://localhost:5000';
const DOCTOR_TOKEN = 'YOUR_DOCTOR_JWT_TOKEN';
const DOCTOR_ID = 1;

// ===== REST API Examples =====

async function createTodayQueue() {
  const today = new Date().toISOString().split('T')[0];
  
  const response = await fetch(`${API_URL}/api/queues/${DOCTOR_ID}/date/${today}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`
    }
  });
  
  const data = await response.json();
  console.log('صف ایجاد شد:', data.queue);
  return data.queue;
}

async function getTodayQueue() {
  const today = new Date().toISOString().split('T')[0];
  
  const response = await fetch(`${API_URL}/api/queues/${DOCTOR_ID}/date/${today}`, {
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`
    }
  });
  
  const data = await response.json();
  console.log('صف امروز:', data.queue);
  console.log('تعداد بیماران:', data.queue.items.length);
  
  return data.queue;
}

async function enqueuePatient(queueId, patientId) {
  const response = await fetch(`${API_URL}/api/queues/${queueId}/enqueue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patient_id: patientId,
      expected_duration_minutes: 10
    })
  });
  
  const data = await response.json();
  console.log('بیمار به صف اضافه شد:', data.queue_item);
  return data.queue_item;
}

async function startVisit(queueItemId) {
  const response = await fetch(`${API_URL}/api/queue-items/${queueItemId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`
    }
  });
  
  const data = await response.json();
  console.log('ویزیت شروع شد');
  return data;
}

async function extendVisit(queueItemId, extraMinutes) {
  const response = await fetch(`${API_URL}/api/queue-items/${queueItemId}/extend`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      extra_minutes: extraMinutes,
      note: 'نیاز به زمان بیشتر'
    })
  });
  
  const data = await response.json();
  console.log('زمان ویزیت افزایش یافت');
  return data;
}

async function endVisit(queueItemId) {
  const response = await fetch(`${API_URL}/api/queue-items/${queueItemId}/end`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`
    }
  });
  
  const data = await response.json();
  console.log('ویزیت پایان یافت. مدت زمان واقعی:', data.actual_duration, 'دقیقه');
  return data;
}

async function getDoctorSettings() {
  const response = await fetch(`${API_URL}/api/doctors/${DOCTOR_ID}/settings`, {
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`
    }
  });
  
  const data = await response.json();
  console.log('تنظیمات پزشک:', data.settings);
  return data.settings;
}

async function updateDoctorSettings(settings) {
  const response = await fetch(`${API_URL}/api/doctors/${DOCTOR_ID}/settings`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${DOCTOR_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
  
  const data = await response.json();
  console.log('تنظیمات به‌روزرسانی شد');
  return data;
}

// ===== WebSocket Examples =====

function setupWebSocket() {
  const socket = io(API_URL, {
    auth: {
      token: DOCTOR_TOKEN
    }
  });
  
  socket.on('connect', () => {
    console.log('✓ اتصال WebSocket برقرار شد');
    
    // عضویت در اتاق پزشک
    socket.emit('join:doctor', { doctorId: DOCTOR_ID });
  });
  
  socket.on('joined:doctor', (data) => {
    console.log('✓ عضو اتاق پزشک شدید:', data.doctorId);
  });
  
  socket.on('joined:queue', (data) => {
    console.log('✓ عضو صف شدید:', data.queueId);
  });
  
  // دریافت به‌روزرسانی‌های صف
  socket.on('queue.update', (data) => {
    console.log('📋 صف به‌روزرسانی شد:', data.queueId);
    console.log('تعداد آیتم‌ها:', data.items.length);
    
    // نمایش لیست بیماران
    data.items.forEach((item, index) => {
      const startTime = new Date(item.estimated_start_at).toLocaleTimeString('fa-IR');
      console.log(`  ${index + 1}. ${item.patient_name} - زمان تخمینی: ${startTime}`);
    });
  });
  
  socket.on('queue.item.started', (data) => {
    console.log('▶️  ویزیت شروع شد:', data.queueItemId);
    // نمایش تایمر در UI
  });
  
  socket.on('queue.item.ended', (data) => {
    console.log('⏹️  ویزیت پایان یافت:', data.queueItemId);
    console.log('مدت زمان واقعی:', data.actualDuration, 'دقیقه');
  });
  
  socket.on('queue.estimated_change', (data) => {
    console.log('⏰ زمان‌های تخمینی تغییر کرد');
    console.log('آیتم‌های تحت تأثیر:', data.affected_items.length);
  });
  
  socket.on('timer.tick', (data) => {
    console.log('⏱️  تایمر:', data.remainingSeconds, 'ثانیه');
  });
  
  socket.on('error', (error) => {
    console.error('❌ خطا:', error.message);
  });
  
  socket.on('disconnect', () => {
    console.log('✗ اتصال قطع شد');
  });
  
  return socket;
}

// ===== سناریوی کامل =====

async function completeScenario() {
  console.log('\n=== شروع سناریوی کامل ===\n');
  
  try {
    // 1. دریافت تنظیمات
    console.log('1️⃣  دریافت تنظیمات پزشک...');
    await getDoctorSettings();
    
    // 2. ایجاد صف امروز
    console.log('\n2️⃣  ایجاد صف امروز...');
    const queue = await createTodayQueue();
    
    // 3. راه‌اندازی WebSocket
    console.log('\n3️⃣  راه‌اندازی WebSocket...');
    const socket = setupWebSocket();
    
    // صبر برای اتصال
    await new Promise(resolve => {
      socket.on('connect', () => {
        socket.emit('join:queue', { queueId: queue.id });
        setTimeout(resolve, 1000);
      });
    });
    
    // 4. اضافه کردن بیماران
    console.log('\n4️⃣  اضافه کردن بیماران به صف...');
    const patient1 = await enqueuePatient(queue.id, 5);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const patient2 = await enqueuePatient(queue.id, 6);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const patient3 = await enqueuePatient(queue.id, 7);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. نمایش صف
    console.log('\n5️⃣  نمایش صف کامل...');
    await getTodayQueue();
    
    // 6. شروع ویزیت اول
    console.log('\n6️⃣  شروع ویزیت بیمار اول...');
    await startVisit(patient1.id);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 7. افزایش زمان
    console.log('\n7️⃣  افزایش زمان ویزیت...');
    await extendVisit(patient1.id, 5);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 8. پایان ویزیت
    console.log('\n8️⃣  پایان ویزیت...');
    await endVisit(patient1.id);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 9. نمایش صف به‌روزرسانی شده
    console.log('\n9️⃣  نمایش صف به‌روزرسانی شده...');
    await getTodayQueue();
    
    console.log('\n✅ سناریو با موفقیت اجرا شد!\n');
    
    // نگه داشتن اتصال برای دریافت رویدادها
    console.log('در حال گوش دادن به رویدادها... (Ctrl+C برای خروج)');
    
  } catch (error) {
    console.error('❌ خطا در اجرای سناریو:', error.message);
  }
}

// ===== اجرا =====

// برای اجرای سناریوی کامل:
// completeScenario();

// یا استفاده تکی از توابع:
// getTodayQueue();
// setupWebSocket();

module.exports = {
  createTodayQueue,
  getTodayQueue,
  enqueuePatient,
  startVisit,
  extendVisit,
  endVisit,
  getDoctorSettings,
  updateDoctorSettings,
  setupWebSocket,
  completeScenario
};
