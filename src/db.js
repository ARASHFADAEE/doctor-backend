const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    // Create tables if not exist
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(11) UNIQUE NOT NULL,
        name VARCHAR(100),
        national_id CHAR(10),
        age TINYINT CHECK (age >= 1 AND age <= 120),
        role ENUM('patient', 'doctor', 'admin') DEFAULT 'patient',
        is_verified BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
        INDEX(phone)
      );
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS medical_tests (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        patient_id BIGINT NOT NULL,
        doctor_id BIGINT NULL,
        image_path VARCHAR(500) NOT NULL,
        description TEXT,
        ai_result TEXT,
        status ENUM('pending', 'processed', 'urgent') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(11) NOT NULL,
        code CHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX(phone),
        INDEX(expires_at)
      );
    `);
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  initDB,
};

