-- Communication Hub Database Schema
-- Migration 002: Add communication tables
-- Based on YFEvents PHP communication schema

-- Channels for communication
CREATE TABLE IF NOT EXISTS communication_channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    type ENUM('public', 'private', 'event', 'vendor', 'announcement') DEFAULT 'public',
    created_by_user_id INT NOT NULL,
    event_id INT NULL,
    shop_id INT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    settings JSON,
    message_count INT DEFAULT 0,
    participant_count INT DEFAULT 0,
    last_activity_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_channels_type (type),
    INDEX idx_channels_event (event_id),
    INDEX idx_channels_shop (shop_id),
    INDEX idx_channels_activity (last_activity_at),
    INDEX idx_channels_archived (is_archived),
    INDEX idx_channels_slug (slug),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
    FOREIGN KEY (shop_id) REFERENCES local_shops(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages for communication
CREATE TABLE IF NOT EXISTS communication_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_message_id INT NULL,
    content TEXT NOT NULL,
    content_type ENUM('text', 'system', 'announcement') DEFAULT 'text',
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    metadata JSON,
    email_message_id VARCHAR(255) NULL,
    reply_count INT DEFAULT 0,
    reaction_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    INDEX idx_messages_channel (channel_id),
    INDEX idx_messages_user (user_id),
    INDEX idx_messages_parent (parent_message_id),
    INDEX idx_messages_created (created_at),
    INDEX idx_messages_deleted (is_deleted),
    INDEX idx_messages_email (email_message_id),
    INDEX idx_messages_channel_created (channel_id, created_at),
    FOREIGN KEY (channel_id) REFERENCES communication_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_message_id) REFERENCES communication_messages(id) ON DELETE SET NULL,

    FULLTEXT KEY ft_messages_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Channel participants
CREATE TABLE IF NOT EXISTS communication_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('member', 'admin') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_message_id INT NULL,
    last_read_at TIMESTAMP NULL,
    notification_preference ENUM('all', 'mentions', 'none') DEFAULT 'all',
    email_digest_frequency ENUM('real-time', 'daily', 'weekly', 'none') DEFAULT 'daily',
    is_muted BOOLEAN DEFAULT FALSE,

    UNIQUE KEY uk_participants (channel_id, user_id),
    INDEX idx_participants_user (user_id),
    INDEX idx_participants_channel (channel_id),
    INDEX idx_participants_role (role),
    INDEX idx_participants_digest (email_digest_frequency),
    INDEX idx_participants_last_read (user_id, last_read_at),
    FOREIGN KEY (channel_id) REFERENCES communication_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (last_read_message_id) REFERENCES communication_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Communication file attachments
CREATE TABLE IF NOT EXISTS communication_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    is_image BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_attachments_message (message_id),
    INDEX idx_attachments_created (created_at),
    FOREIGN KEY (message_id) REFERENCES communication_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email integration for channels
CREATE TABLE IF NOT EXISTS communication_email_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL UNIQUE,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    secret_token VARCHAR(32) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_email_active (is_active),
    FOREIGN KEY (channel_id) REFERENCES communication_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Communication notifications
CREATE TABLE IF NOT EXISTS communication_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    channel_id INT NULL,
    message_id INT NULL,
    type ENUM('mention', 'reply', 'new_message', 'announcement', 'channel_invite') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_emailed BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,

    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_unread (user_id, is_read),
    INDEX idx_notifications_created (created_at),
    INDEX idx_notifications_type (type),
    INDEX idx_notifications_user_unread (user_id, is_read, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (channel_id) REFERENCES communication_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES communication_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Message reactions
CREATE TABLE IF NOT EXISTS communication_reactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_reactions (message_id, user_id, emoji),
    INDEX idx_reactions_message (message_id),
    INDEX idx_reactions_user (user_id),
    FOREIGN KEY (message_id) REFERENCES communication_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
