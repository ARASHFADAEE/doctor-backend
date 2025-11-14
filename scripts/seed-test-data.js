/**
 * اسکریپت seed کردن داده‌های تستی
 * برای تست سیستم صف
 */

require('dotenv').config();
const { pool } = require('../src/db');

async function seedTestData() {
  console.log('🌱 شروع seed کردن داده‌های تستی...\n');
  
  try {
    // 1. ایجاد پزشک تستی
    console.log('1️⃣  ایجاد پزشک تستی...');
    const [doctorResult] = await pool.query(
      `INSERT INTO users (phone, name, role, is_verified) 
       VALUES ('09121234567', 'دکتر علی احمدی', 'doctor', true)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    const doctorId = doctorResult.insertId;
    console.log(`   ✓ پزشک ایجاد شد (ID: ${doctorId})`);
    
    // 2. تنظیمات پزشک
    console.log('\n2️⃣  تنظیم settings پزشک...');
    await pool.query(
      `INSERT INTO doctor_settings (doctor_id, default_duration_minutes, buffer_after_minutes)
       VALUES (?, 8, 2)
       ON DUPLICATE KEY UPDATE default_duration_minutes=8, buffer_after_minutes=2`,
      [doctorId]
    );
    console.log('   ✓ تنظیمات ذخیره شد');
    
    // 3. ایجاد بیماران تستی
    console.log('\n3️⃣  ایجاد بیماران تستی...');
    const patients = [
      { phone: '09121111111', name: 'محمد رضایی' },
      { phone: '09122222222', name: 'فاطمه کریمی' },
      { phone: '09123333333', name: 'حسین محمدی' },
      { phone: '09124444444', name: 'زهرا حسینی' },
      { phone: '09125555555', name: 'علی نوری' }
    ];
    
    const patientIds = [];
    for (const patient of patients) {
      const [result] = await pool.query(
        `INSERT INTO users (phone, name, role, is_verified)
         VALUES (?, ?, 'patient', true)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [patient.phone, patient.name]
      );
      patientIds.push(result.insertId);
      console.log(`   ✓ ${patient.name} (ID: ${result.insertId})`);
    }
    
    // 4. ایجاد صف امروز
    console.log('\n4️⃣  ایجاد صف امروز...');
    const today = new Date().toISOString().split('T')[0];
    const [queueResult] = await pool.query(
      `INSERT INTO doctor_queues (doctor_id, date)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [doctorId, today]
    );
    const queueId = queueResult.insertId;
    console.log(`   ✓ صف ایجاد شد (ID: ${queueId}, تاریخ: ${today})`);
    
    // 5. اضافه کردن بیماران به صف
    console.log('\n5️⃣  اضافه کردن بیماران به صف...');
    for (let i = 0; i < patientIds.length; i++) {
      const patientId = patientIds[i];
      const position = i + 1;
      const duration = 8 + Math.floor(Math.random() * 5); // 8-12 دقیقه
      
      await pool.query(
        `INSERT INTO queue_items 
         (queue_id, patient_id, position, expected_duration_minutes, status)
         VALUES (?, ?, ?, ?, 'waiting')`,
        [queueId, patientId, position, duration]
      );
      console.log(`   ✓ بیمار ${position} اضافه شد (مدت: ${duration} دقیقه)`);
    }
    
    // 6. محاسبه ETAs
    console.log('\n6️⃣  محاسبه زمان‌های تخمینی...');
    const queueService = require('../src/services/queue.service');
    await queueService.recalculateETAs(queueId);
    console.log('   ✓ زمان‌های تخمینی محاسبه شد');
    
    // 7. اضافه کردن داده‌های تاریخی برای آنالیز
    console.log('\n7️⃣  اضافه کردن داده‌های تاریخی...');
    for (let i = 0; i < 10; i++) {
      const randomPatient = patientIds[Math.floor(Math.random() * patientIds.length)];
      const randomDuration = 6 + Math.floor(Math.random() * 10); // 6-15 دقیقه
      const daysAgo = Math.floor(Math.random() * 90); // تا 90 روز قبل
      
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() - daysAgo);
      const visitDateStr = visitDate.toISOString().split('T')[0];
      
      await pool.query(
        `INSERT INTO visit_durations (doctor_id, patient_id, duration_minutes, visit_date)
         VALUES (?, ?, ?, ?)`,
        [doctorId, randomPatient, randomDuration, visitDateStr]
      );
    }
    console.log('   ✓ 10 رکورد تاریخی اضافه شد');
    
    // 8. نمایش خلاصه
    console.log('\n' + '='.repeat(50));
    console.log('✅ داده‌های تستی با موفقیت ایجاد شد!\n');
    console.log('📋 خلاصه:');
    console.log(`   - پزشک ID: ${doctorId}`);
    console.log(`   - تعداد بیماران: ${patientIds.length}`);
    console.log(`   - صف ID: ${queueId}`);
    console.log(`   - تاریخ صف: ${today}`);
    console.log('\n💡 برای تست API:');
    console.log(`   curl http://localhost:5000/api/queues/${doctorId}/date/${today}`);
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.error('❌ خطا در seed کردن داده‌ها:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// اجرا
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedTestData };
