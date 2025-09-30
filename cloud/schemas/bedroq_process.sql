-- Create database schema
CREATE DATABASE document_processing;
USE document_processing;

-- Processing jobs table
CREATE TABLE processing_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    processing_id VARCHAR(36) UNIQUE NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    stage1_output_key VARCHAR(512),
    stage2_output_key VARCHAR(512),
    final_output_key VARCHAR(512),
    status ENUM('uploaded', 'stage1_processing', 'stage1_complete', 
                'stage2_processing', 'stage2_complete', 'completed', 'failed') 
           DEFAULT 'uploaded',
    created_at DATETIME NOT NULL,
    updated_at DATETIME,
    completed_at DATETIME,
    INDEX idx_processing_id (processing_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Processing metrics table
CREATE TABLE processing_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    processing_id VARCHAR(36) NOT NULL,
    total_processing_time INT, -- in seconds
    created_at DATETIME NOT NULL,
    FOREIGN KEY (processing_id) REFERENCES processing_jobs(processing_id)
);

-- Error logs table
CREATE TABLE error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    processing_id VARCHAR(36),
    stage VARCHAR(50),
    error_message TEXT,
    stack_trace TEXT,
    created_at DATETIME NOT NULL,
    INDEX idx_processing_id (processing_id)
);
