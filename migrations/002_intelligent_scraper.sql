-- Migration: Add Intelligent Scraper Tables
-- Run this on the yakima_finds database
-- Note: calendar_sources uses scrape_type column and already has intelligent/yakima_valley types

-- ============================================================================
-- Intelligent Scraper Methods Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    url_pattern VARCHAR(500),
    method_type ENUM('event_list', 'event_detail', 'combined') NOT NULL,
    extraction_rules JSON NOT NULL,
    selector_mappings JSON,
    post_processing JSON,
    llm_model VARCHAR(100),
    confidence_score DECIMAL(3,2),
    test_results JSON,
    active BOOLEAN DEFAULT TRUE,
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    INDEX idx_domain (domain),
    INDEX idx_active (active),
    INDEX idx_confidence (confidence_score),
    INDEX idx_last_used (last_used)
);

-- ============================================================================
-- Intelligent Scraper Sessions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    page_content MEDIUMTEXT,
    llm_analysis JSON,
    found_events JSON,
    method_id INT NULL,
    status ENUM('analyzing', 'events_found', 'no_events', 'error', 'approved') DEFAULT 'analyzing',
    error_message TEXT,
    user_feedback TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (method_id) REFERENCES intelligent_scraper_methods(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- ============================================================================
-- Intelligent Scraper Cache Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    method_id INT NOT NULL,
    extracted_data JSON NOT NULL,
    extraction_time DECIMAL(10,3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (method_id) REFERENCES intelligent_scraper_methods(id) ON DELETE CASCADE,
    INDEX idx_url (url),
    INDEX idx_method (method_id),
    INDEX idx_created_at (created_at)
);

-- ============================================================================
-- Intelligent Scraper Patterns Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    pattern_type ENUM('event_list', 'event_detail', 'calendar', 'api') NOT NULL,
    url_pattern VARCHAR(500) NOT NULL,
    pattern_regex VARCHAR(500),
    example_urls JSON,
    confidence DECIMAL(3,2),
    discovered_by_session INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discovered_by_session) REFERENCES intelligent_scraper_sessions(id) ON DELETE SET NULL,
    INDEX idx_domain (domain),
    INDEX idx_pattern_type (pattern_type)
);

-- ============================================================================
-- Intelligent Scraper Batches Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255),
    total_urls INT DEFAULT 0,
    processed_urls INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    total_events INT DEFAULT 0,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    INDEX idx_status (status)
);

-- ============================================================================
-- Intelligent Scraper Batch Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_batch_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    title VARCHAR(255),
    url VARCHAR(500) NOT NULL,
    session_id INT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    events_found INT DEFAULT 0,
    error_message TEXT,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (batch_id) REFERENCES intelligent_scraper_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES intelligent_scraper_sessions(id) ON DELETE SET NULL,
    INDEX idx_batch (batch_id),
    INDEX idx_status (status)
);

-- ============================================================================
-- Intelligent Scraper Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS intelligent_scraper_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NULL,
    session_id INT NULL,
    level ENUM('debug', 'info', 'warning', 'error') DEFAULT 'info',
    message TEXT NOT NULL,
    details TEXT,
    url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES intelligent_scraper_batches(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES intelligent_scraper_sessions(id) ON DELETE SET NULL,
    INDEX idx_batch (batch_id),
    INDEX idx_level (level)
);
