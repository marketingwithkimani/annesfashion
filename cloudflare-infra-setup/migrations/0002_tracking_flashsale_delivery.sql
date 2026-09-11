-- Migration 0002: Tracking, Flash Sale Mode, and Pickup Mtaani Delivery Rates

-- 1. Extend sales table with tracking, delivery status, area, and delivery fee
ALTER TABLE sales ADD COLUMN tracking_number TEXT;
ALTER TABLE sales ADD COLUMN delivery_status TEXT DEFAULT 'processing';
ALTER TABLE sales ADD COLUMN delivery_area TEXT;
ALTER TABLE sales ADD COLUMN delivery_fee REAL DEFAULT 0;

-- 2. Shipment and Parcel Live Updates Table (Broadcast by Admin)
CREATE TABLE IF NOT EXISTS shipment_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    update_text TEXT NOT NULL,
    status_badge TEXT DEFAULT 'In Transit',
    waybill_number TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shipment_updates_created ON shipment_updates(created_at);

-- 3. Preset Delivery Rates & Locations (Pickup Mtaani Rates Kenya)
CREATE TABLE IF NOT EXISTS delivery_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone TEXT NOT NULL,
    area_name TEXT NOT NULL UNIQUE,
    pickup_rate REAL NOT NULL,
    doorstep_rate REAL NOT NULL,
    estimated_delivery TEXT DEFAULT '24-48 hrs'
);

CREATE INDEX IF NOT EXISTS idx_delivery_area_name ON delivery_locations(area_name);

-- Seed Settings for Flash Sale Mode
INSERT INTO settings (setting_key, setting_value, updated_at) 
VALUES ('flash_sale_mode', 'off', datetime('now'))
ON CONFLICT(setting_key) DO NOTHING;

-- Seed Initial Shipment Update
INSERT INTO shipment_updates (title, update_text, status_badge, waybill_number)
VALUES (
    'Pre-order Batch Dispatched',
    'Consignment has departed our international supplier and is in transit to Nairobi. Customs clearance scheduled upon arrival.',
    'In Transit',
    'AF-WAYBILL-2026-09'
);

-- Seed Comprehensive Pickup Mtaani Kenya Delivery Locations & Rates
INSERT OR IGNORE INTO delivery_locations (zone, area_name, pickup_rate, doorstep_rate, estimated_delivery) VALUES
-- Nairobi CBD
('Nairobi CBD', 'Nairobi CBD / Town', 100, 200, 'Same Day / 24 hrs'),

-- Nairobi Core Estates
('Nairobi Core', 'Westlands', 150, 250, '24 hrs'),
('Nairobi Core', 'Kilimani', 150, 250, '24 hrs'),
('Nairobi Core', 'Kileleshwa', 150, 250, '24 hrs'),
('Nairobi Core', 'Lavington', 150, 250, '24 hrs'),
('Nairobi Core', 'Parklands', 150, 250, '24 hrs'),
('Nairobi Core', 'Ngara', 150, 250, '24 hrs'),
('Nairobi Core', 'Pangani', 150, 250, '24 hrs'),
('Nairobi Core', 'South B', 150, 250, '24 hrs'),
('Nairobi Core', 'South C', 150, 250, '24 hrs'),
('Nairobi Core', 'Nairobi West', 150, 250, '24 hrs'),
('Nairobi Core', 'Madaraka', 150, 250, '24 hrs'),
('Nairobi Core', 'Upper Hill', 150, 250, '24 hrs'),
('Nairobi Core', 'Hurlingham', 150, 250, '24 hrs'),
('Nairobi Core', 'Eastleigh', 150, 250, '24 hrs'),

-- Nairobi Outer / Suburbs
('Nairobi Outer', 'Roysambu', 180, 280, '24 hrs'),
('Nairobi Outer', 'Kasarani', 180, 280, '24 hrs'),
('Nairobi Outer', 'Kahawa West', 180, 280, '24 hrs'),
('Nairobi Outer', 'Kahawa Sukari', 180, 280, '24 hrs'),
('Nairobi Outer', 'Kahawa Wendani', 180, 280, '24 hrs'),
('Nairobi Outer', 'Zimmerman', 180, 280, '24 hrs'),
('Nairobi Outer', 'Githurai 44', 180, 280, '24 hrs'),
('Nairobi Outer', 'Githurai 45', 180, 280, '24 hrs'),
('Nairobi Outer', 'Ruaka', 180, 280, '24 hrs'),
('Nairobi Outer', 'Kiambu Road', 180, 280, '24 hrs'),
('Nairobi Outer', 'Ridgeways', 180, 280, '24 hrs'),
('Nairobi Outer', 'Runda', 180, 300, '24 hrs'),
('Nairobi Outer', 'Karen', 180, 300, '24 hrs'),
('Nairobi Outer', 'Langata', 180, 280, '24 hrs'),
('Nairobi Outer', 'Ongata Rongai', 180, 300, '24-48 hrs'),
('Nairobi Outer', 'Embakasi', 180, 280, '24 hrs'),
('Nairobi Outer', 'Donholm', 180, 280, '24 hrs'),
('Nairobi Outer', 'Umoja', 180, 280, '24 hrs'),
('Nairobi Outer', 'Fedha', 180, 280, '24 hrs'),
('Nairobi Outer', 'Buruburu', 180, 280, '24 hrs'),
('Nairobi Outer', 'Pipeline', 180, 280, '24 hrs'),
('Nairobi Outer', 'Tassia', 180, 280, '24 hrs'),
('Nairobi Outer', 'Komarock', 180, 280, '24 hrs'),
('Nairobi Outer', 'Kayole', 180, 280, '24 hrs'),
('Nairobi Outer', 'Utawala', 180, 300, '24-48 hrs'),
('Nairobi Outer', 'Ruai', 180, 300, '24-48 hrs'),

-- Nairobi Metro & Satellite
('Nairobi Metro', 'Thika Town', 200, 320, '24 hrs'),
('Nairobi Metro', 'Ruiru', 200, 300, '24 hrs'),
('Nairobi Metro', 'Juja', 200, 300, '24 hrs'),
('Nairobi Metro', 'Kiambu Town', 200, 300, '24 hrs'),
('Nairobi Metro', 'Kikuyu', 200, 300, '24 hrs'),
('Nairobi Metro', 'Kitengela', 200, 320, '24-48 hrs'),
('Nairobi Metro', 'Athi River', 200, 320, '24-48 hrs'),
('Nairobi Metro', 'Syokimau', 180, 280, '24 hrs'),
('Nairobi Metro', 'Ngong Town', 200, 320, '24-48 hrs'),
('Nairobi Metro', 'Machakos', 220, 350, '24-48 hrs'),

-- Major Towns & Upcountry
('Central & Rift', 'Nakuru', 220, 350, '24-48 hrs'),
('Central & Rift', 'Naivasha', 220, 350, '24-48 hrs'),
('Central & Rift', 'Nyeri', 220, 350, '24-48 hrs'),
('Central & Rift', 'Karatina', 220, 350, '24-48 hrs'),
('Central & Rift', 'Embu', 220, 350, '24-48 hrs'),
('Central & Rift', 'Meru', 250, 380, '24-48 hrs'),
('Central & Rift', 'Eldoret', 250, 380, '24-48 hrs'),
('Central & Rift', 'Kericho', 250, 380, '24-48 hrs'),
('Coast', 'Mombasa CBD / Nyali', 280, 420, '48 hrs'),
('Coast', 'Mtwapa', 280, 420, '48 hrs'),
('Coast', 'Malindi', 300, 450, '48 hrs'),
('Coast', 'Diani', 300, 450, '48 hrs'),
('Western & Nyanza', 'Kisumu', 250, 380, '24-48 hrs'),
('Western & Nyanza', 'Kakamega', 250, 380, '24-48 hrs'),
('Western & Nyanza', 'Kisii', 250, 380, '24-48 hrs'),
('Western & Nyanza', 'Kitale', 280, 420, '48 hrs'),
('Western & Nyanza', 'Bungoma', 280, 420, '48 hrs');
