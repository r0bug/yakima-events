-- Yakima Events Calendar Schema
-- Initial migration

-- Events table
CREATE TABLE IF NOT EXISTS `events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `start_datetime` DATETIME NOT NULL,
  `end_datetime` DATETIME,
  `location` VARCHAR(255),
  `address` VARCHAR(500),
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `contact_info` JSON,
  `external_url` VARCHAR(500),
  `primary_image` VARCHAR(255),
  `source_id` INT,
  `external_event_id` VARCHAR(255),
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `featured` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_events_status` (`status`),
  INDEX `idx_events_start_datetime` (`start_datetime`),
  INDEX `idx_events_location` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event Categories table
CREATE TABLE IF NOT EXISTS `event_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `icon` VARCHAR(50),
  `color` VARCHAR(7),
  `parent_id` INT,
  `sort_order` INT DEFAULT 0,
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `event_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event Category Mapping table
CREATE TABLE IF NOT EXISTS `event_category_mapping` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_id` INT NOT NULL,
  `category_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_event_category_event` (`event_id`),
  INDEX `idx_event_category_category` (`category_id`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `event_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event Images table
CREATE TABLE IF NOT EXISTS `event_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_id` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `alt_text` VARCHAR(255),
  `is_primary` BOOLEAN DEFAULT FALSE,
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_event_images_event` (`event_id`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calendar Sources table (for event scraping)
CREATE TABLE IF NOT EXISTS `calendar_sources` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `type` ENUM('ical', 'html', 'json', 'rss') DEFAULT 'ical',
  `configuration` JSON,
  `active` BOOLEAN DEFAULT TRUE,
  `last_scraped` DATETIME,
  `scrape_frequency` INT DEFAULT 3600,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Local Shops table
CREATE TABLE IF NOT EXISTS `local_shops` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `address` VARCHAR(500) NOT NULL,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `phone` VARCHAR(20),
  `email` VARCHAR(255),
  `website` VARCHAR(500),
  `category_id` INT,
  `operating_hours` JSON,
  `payment_methods` JSON,
  `amenities` JSON,
  `primary_image` VARCHAR(255),
  `featured` BOOLEAN DEFAULT FALSE,
  `verified` BOOLEAN DEFAULT FALSE,
  `owner_id` INT,
  `status` ENUM('pending', 'active', 'inactive') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_shops_status` (`status`),
  INDEX `idx_shops_category` (`category_id`),
  INDEX `idx_shops_location` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shop Categories table
CREATE TABLE IF NOT EXISTS `shop_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `icon` VARCHAR(50),
  `color` VARCHAR(7),
  `parent_id` INT,
  `sort_order` INT DEFAULT 0,
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `shop_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shop Images table
CREATE TABLE IF NOT EXISTS `shop_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shop_id` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `alt_text` VARCHAR(255),
  `is_primary` BOOLEAN DEFAULT FALSE,
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_shop_images_shop` (`shop_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `local_shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scraping Logs table
CREATE TABLE IF NOT EXISTS `scraping_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `source_id` INT NOT NULL,
  `start_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `end_time` TIMESTAMP NULL,
  `status` ENUM('running', 'success', 'failed') DEFAULT 'running',
  `events_found` INT DEFAULT 0,
  `events_added` INT DEFAULT 0,
  `duplicates_skipped` INT DEFAULT 0,
  `error_message` TEXT,
  `duration_ms` INT,
  PRIMARY KEY (`id`),
  INDEX `idx_scraping_logs_source` (`source_id`),
  INDEX `idx_scraping_logs_status` (`status`),
  FOREIGN KEY (`source_id`) REFERENCES `calendar_sources`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for events to calendar_sources
ALTER TABLE `events` ADD CONSTRAINT `fk_events_source`
  FOREIGN KEY (`source_id`) REFERENCES `calendar_sources`(`id`) ON DELETE SET NULL;

-- Add foreign key for shops to shop_categories
ALTER TABLE `local_shops` ADD CONSTRAINT `fk_shops_category`
  FOREIGN KEY (`category_id`) REFERENCES `shop_categories`(`id`) ON DELETE SET NULL;

-- Sample data: Event Categories
INSERT INTO `event_categories` (`name`, `slug`, `icon`, `color`, `sort_order`) VALUES
('Music', 'music', 'music', '#9333ea', 1),
('Arts & Culture', 'arts-culture', 'palette', '#ec4899', 2),
('Food & Drink', 'food-drink', 'utensils', '#f97316', 3),
('Sports & Fitness', 'sports-fitness', 'trophy', '#22c55e', 4),
('Community', 'community', 'users', '#3b82f6', 5),
('Education', 'education', 'graduation-cap', '#6366f1', 6),
('Family', 'family', 'heart', '#ef4444', 7),
('Business', 'business', 'briefcase', '#64748b', 8),
('Outdoor', 'outdoor', 'tree', '#059669', 9),
('Nightlife', 'nightlife', 'moon', '#7c3aed', 10);

-- Sample data: Shop Categories
INSERT INTO `shop_categories` (`name`, `slug`, `icon`, `color`, `sort_order`) VALUES
('Antiques', 'antiques', 'clock', '#8b5cf6', 1),
('Thrift Stores', 'thrift', 'shirt', '#ec4899', 2),
('Vintage', 'vintage', 'sparkles', '#f59e0b', 3),
('Consignment', 'consignment', 'tag', '#10b981', 4),
('Collectibles', 'collectibles', 'gem', '#3b82f6', 5),
('Furniture', 'furniture', 'armchair', '#6366f1', 6),
('Art Galleries', 'art', 'image', '#ef4444', 7),
('Books', 'books', 'book-open', '#84cc16', 8);
