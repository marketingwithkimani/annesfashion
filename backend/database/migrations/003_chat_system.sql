-- =====================================================
-- Anne's Fashion Line — Chat System Migration
-- Compatible with MySQL/MariaDB & PostgreSQL
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(100) DEFAULT 'Guest Customer',
    customer_email VARCHAR(100) NULL,
    customer_phone VARCHAR(20) NULL,
    current_product_id BIGINT NULL,
    current_product_title VARCHAR(250) NULL,
    current_page VARCHAR(250) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AI_ACTIVE',
    assigned_staff_id BIGINT NULL,
    assigned_staff_name VARCHAR(100) NULL,
    last_message TEXT NULL,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    sender_id VARCHAR(100) NULL,
    content TEXT NOT NULL,
    metadata TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
