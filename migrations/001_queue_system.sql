-- Migration: Clinic Queue & Dynamic Scheduling System
-- Description: Tables for managing doctor queues, appointments, and real-time scheduling

-- Doctor settings for queue management
CREATE TABLE IF NOT EXISTS doctor_settings (
  doctor_id BIGINT PRIMARY KEY,
  default_duration_minutes INT NOT NULL DEFAULT 8,
  buffer_before_minutes INT NOT NULL DEFAULT 0,
  buffer_after_minutes INT NOT NULL DEFAULT 0,
  allow_overflow BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rooms (optional, for multi-room clinics)
CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_doctor_active (doctor_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointments/Visits
CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  scheduled_time DATETIME NULL,
  expected_duration_minutes INT NULL,
  status ENUM('scheduled','checked_in','in_room','completed','no_show','cancelled') DEFAULT 'scheduled',
  room_id BIGINT NULL,
  actual_start_at DATETIME NULL,
  actual_end_at DATETIME NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  INDEX idx_doctor_date (doctor_id, scheduled_time),
  INDEX idx_patient (patient_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily queues per doctor
CREATE TABLE IF NOT EXISTS doctor_queues (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_doctor_date (doctor_id, date),
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Queue items (patients in queue)
CREATE TABLE IF NOT EXISTS queue_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  queue_id BIGINT NOT NULL,
  appointment_id BIGINT NULL,
  patient_id BIGINT NOT NULL,
  position INT NOT NULL,
  expected_duration_minutes INT NOT NULL,
  estimated_start_at DATETIME NULL,
  estimated_end_at DATETIME NULL,
  status ENUM('waiting','in_progress','done','skipped','cancelled') DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES doctor_queues(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_queue_position (queue_id, position),
  INDEX idx_queue_status (queue_id, status),
  UNIQUE KEY uk_queue_position (queue_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Queue events for audit and analytics
CREATE TABLE IF NOT EXISTS queue_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  queue_item_id BIGINT NOT NULL,
  event_type ENUM('start','pause','extend','end','manual_override','reposition') NOT NULL,
  actor VARCHAR(50),
  actor_id BIGINT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  metadata JSON,
  FOREIGN KEY (queue_item_id) REFERENCES queue_items(id) ON DELETE CASCADE,
  INDEX idx_queue_item (queue_item_id),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historical visit durations for analytics
CREATE TABLE IF NOT EXISTS visit_durations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NOT NULL,
  patient_id BIGINT NOT NULL,
  appointment_id BIGINT NULL,
  duration_minutes INT NOT NULL,
  visit_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_doctor_patient (doctor_id, patient_id),
  INDEX idx_doctor_date (doctor_id, visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
