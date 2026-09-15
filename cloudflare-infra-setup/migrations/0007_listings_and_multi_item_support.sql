-- Migration 0007: Listings and Multi-Item Support
-- Parent-Child structure connecting a shared Listing (video showcase)
-- to 1-3 independent Sellable Items (products).

CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT DEFAULT 'video',
    video_key TEXT,
    video_url TEXT,
    video_poster_key TEXT,
    poster_url TEXT,
    video_duration_seconds INTEGER,
    video_size_bytes INTEGER,
    is_featured INTEGER DEFAULT 0,
    allow_preorder INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add listing linkage to products table
ALTER TABLE products ADD COLUMN listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN item_slot INTEGER DEFAULT 1;

-- Index for efficient lookup of items within a listing
CREATE INDEX IF NOT EXISTS idx_products_listing_id ON products(listing_id);
