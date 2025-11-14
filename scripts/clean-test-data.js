/**
 * اسکریپت پاک کردن داده‌های تستی
 */

require('dotenv').config();
const { pool } = require('../src/db');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function cleanTestData() {
  console.log('🧹 پاک کردن داده‌های تستی\n');
  
  try {
    // تأیید از کاربر
    const answer = await question('⚠️  آیا مطمئن هستید که می‌خواهید تمام داده‌های تستی را پاک کنید؟ (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ عملیات لغو شد');
      return;
    }
    
    console.log('\n🗑️  در حال پاک کردن...\n');
    
    // پاک کردن به ترتیب (به دلیل foreign keys)
    const tables = [
      'queue_events',
      'queue_items',
      'doctor_queues',
      'visit_durations',
      'appointments',
      'rooms',
      'doctor_settings'
    ];
    
    for (const table of tables) {
      const [result] = await pool.query(`DELETE FROM ${table}`);
      console.log(`   ✓ ${table}: ${result.affectedRows} رکورد پاک شد`);
    }
    
    // پاک کردن کاربران تستی (اختیاری)
    const deleteUsers = await question('\n❓ آیا می‌خواهید کاربران تستی را هم پاک کنید؟ (yes/no): ');
    
    if (deleteUsers.toLowerCase() === 'yes') {
      const [result] = await pool.query(
        `DELETE FROM users WHERE phone LIKE '0912%' AND role IN ('doctor', 'patient')`
      );
      console.log(`   ✓ users: ${result.affectedRows} کاربر پاک شد`);
    }
    
    console.log('\n✅ پاک‌سازی با موفقیت انجام شد!\n');
    
  } catch (error) {
    console.error('❌ خطا در پاک کردن داده‌ها:', error.message);
    throw error;
  } finally {
    rl.close();
    await pool.end();
  }
}

// اجرا
if (require.main === module) {
  cleanTestData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { cleanTestData };
