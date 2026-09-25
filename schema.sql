-- CivicPulse: Smart City Citizen Grievance Portal
CREATE DATABASE IF NOT EXISTS civicpulse_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE civicpulse_db;

CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(160),
    category VARCHAR(80) NOT NULL,
    location VARCHAR(255) NOT NULL,
    landmark VARCHAR(160),
    description VARCHAR(1000) NOT NULL,
    priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
    status ENUM('Submitted','Assigned','In Progress','Resolved') NOT NULL DEFAULT 'Submitted',
    photo_filename VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status(status),
    INDEX idx_category(category),
    INDEX idx_priority(priority),
    INDEX idx_created_at(created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id VARCHAR(32) NOT NULL,
    status ENUM('Submitted','Assigned','In Progress','Resolved') NOT NULL,
    remarks VARCHAR(500),
    updated_by VARCHAR(80) DEFAULT 'System',
    event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_complaint
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
      ON DELETE CASCADE,
    INDEX idx_event_complaint(complaint_id)
) ENGINE=InnoDB;

-- Optional demo admin. The Flask app will also create/update a demo admin:
-- username: admin
-- password: Admin@123
