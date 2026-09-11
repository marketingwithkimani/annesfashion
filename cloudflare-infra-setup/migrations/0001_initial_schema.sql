-- =====================================================
-- Anne's Fashion Line — Cloudflare D1 (SQLite) Schema
-- High-Performance Production Schema with Cloudflare Stream & R2 Media Architecture
-- =====================================================

-- 1. USERS TABLE (Admin & Staff)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- 2. CUSTOMERS TABLE (Online & Walk-in)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    pin_hash TEXT,
    address TEXT,
    city TEXT DEFAULT 'Nairobi',
    customer_type TEXT DEFAULT 'walk-in',
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0.00,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    sku TEXT UNIQUE,
    image_url TEXT, -- Legacy image compatibility
    media_type TEXT NOT NULL DEFAULT 'image', -- 'image' | 'video'
    media_reference TEXT, -- Cloudflare Stream UID / playback URL or R2 object key / URL
    poster_reference TEXT, -- R2 poster image URL / key for video preview
    is_active INTEGER DEFAULT 1,
    is_archived INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    allow_preorder INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Fast selective indexes to prevent full-table scans in D1
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);
CREATE INDEX IF NOT EXISTS idx_products_media_type ON products(media_type);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_catalog ON products(is_active, is_archived, category, created_at DESC);

-- 4. PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size TEXT,
    color TEXT,
    sku TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    UNIQUE (product_id, size, color)
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(is_active);

-- 5. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER DEFAULT 5,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE (product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory(variant_id);

-- 6. PRODUCT MEDIA TABLE (R2 Images & Cloudflare Stream Videos)
-- Decouples heavy media metadata from core product row, supports multi-angle gallery
CREATE TABLE IF NOT EXISTS product_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL DEFAULT 'image', -- 'image' | 'video'
    media_reference TEXT NOT NULL, -- Cloudflare Stream UID or R2 path / public URL
    poster_reference TEXT, -- R2 poster path / thumbnail URL
    is_main INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_type ON product_media(media_type);
CREATE INDEX IF NOT EXISTS idx_product_media_sort ON product_media(product_id, is_main DESC, sort_order ASC);

-- 7. SALES TABLE (Orders & Point of Sale)
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number TEXT UNIQUE NOT NULL,
    sale_type TEXT NOT NULL, -- 'online' | 'pos' | 'preorder'
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    customer_city TEXT,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL, -- 'mpesa' | 'cash' | 'card'
    payment_status TEXT DEFAULT 'paid', -- 'pending' | 'paid' | 'cancelled'
    transaction_reference TEXT,
    staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

-- 8. SALE ITEMS TABLE
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    product_title TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);

-- 9. INVENTORY LOGS TABLE (Audit Trail)
CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity_change INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'sale' | 'restock' | 'adjustment' | 'return'
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_logs_action ON inventory_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_inv_logs_created ON inventory_logs(created_at);

-- 10. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 11. CHAT CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Guest Customer',
    customer_email TEXT NULL,
    customer_phone TEXT NULL,
    current_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    current_product_title TEXT NULL,
    current_page TEXT NULL,
    status TEXT NOT NULL DEFAULT 'AI_ACTIVE',
    assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_staff_name TEXT NULL,
    last_message TEXT NULL,
    last_message_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_session ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conv_updated ON chat_conversations(updated_at);

-- 12. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_id TEXT NULL,
    content TEXT NOT NULL,
    metadata TEXT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON chat_messages(created_at);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default system settings
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('pre_order_mode', 'off');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('store_name', "Anne's Fashion Line");
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('support_phone', '+254717159784');

-- Default admin user (Password: admin123)
INSERT OR IGNORE INTO users (username, email, password_hash, role, first_name, last_name)
VALUES (
    'admin',
    'admin@annesfashion.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    'Admin',
    'User'
);

-- Default staff user (Password: staff123)
INSERT OR IGNORE INTO users (username, email, password_hash, role, first_name, last_name)
VALUES (
    'staff',
    'staff@annesfashion.com',
    '$2y$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIVFlYg7B77UdFm',
    'staff',
    'Staff',
    'User'
);
