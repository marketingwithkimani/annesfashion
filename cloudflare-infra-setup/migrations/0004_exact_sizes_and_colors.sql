-- =====================================================
-- Migration 0004: Add Exact Size, Color, and Stock Columns
-- Allows exact waist sizes, bust sizes, and shoe sizes uploaded
-- from the mobile app to be stored and reflected on the website.
-- =====================================================

ALTER TABLE products ADD COLUMN sizes TEXT;
ALTER TABLE products ADD COLUMN colors TEXT;
ALTER TABLE products ADD COLUMN waist_sizes TEXT;
ALTER TABLE products ADD COLUMN bust_sizes TEXT;
ALTER TABLE products ADD COLUMN shoe_sizes TEXT;
ALTER TABLE products ADD COLUMN total_stock INTEGER DEFAULT 0;
