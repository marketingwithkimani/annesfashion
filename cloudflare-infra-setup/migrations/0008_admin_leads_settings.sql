-- Lead generation leads table
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK(category IN ('corporate', 'corporate_women', 'diaspora')),
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  website TEXT,
  notes TEXT,
  email_draft TEXT,
  email_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  page TEXT,
  product_id INTEGER,
  session_id TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Ensure settings table exists (may already exist)
CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default settings if not present
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('hot_picks_mode', 'normal');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('pre_order_mode', 'off');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('flash_sale_mode', 'off');
