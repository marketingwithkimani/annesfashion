-- Migration 0003: R2-Only Video Architecture
-- Replaces Cloudflare Stream with direct R2 video storage.
-- Adds dedicated video metadata columns to products table.
-- All ADD COLUMN — no destructive changes, existing data preserved.

-- Product video R2 storage metadata
ALTER TABLE products ADD COLUMN video_key TEXT;              -- R2 object key e.g. products/123/video/product-video-v1.mp4
ALTER TABLE products ADD COLUMN video_url TEXT;              -- Publicly accessible URL via worker proxy or R2 custom domain
ALTER TABLE products ADD COLUMN video_mime_type TEXT;        -- e.g. video/mp4
ALTER TABLE products ADD COLUMN video_size_bytes INTEGER;    -- File size in bytes
ALTER TABLE products ADD COLUMN video_duration_seconds INTEGER; -- Duration extracted by client before upload
ALTER TABLE products ADD COLUMN video_poster_key TEXT;       -- R2 poster/thumbnail key e.g. products/123/poster/poster-v1.webp

-- Update product_media to clarify R2-only media_reference
-- (No schema change needed — media_reference already stores R2 key or URL)

-- Index for video products query performance
CREATE INDEX IF NOT EXISTS idx_products_video_key ON products(video_key) WHERE video_key IS NOT NULL;
