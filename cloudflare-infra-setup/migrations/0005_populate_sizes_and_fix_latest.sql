-- =====================================================
-- Migration 0005: Populate exact waist and bust sizes for latest products
-- and clean up string "null" on video columns
-- =====================================================

UPDATE products 
SET waist_sizes = '["28\"", "30\"", "32\"", "34\"", "36\""]'
WHERE id IN (9754, 9753);

UPDATE products 
SET waist_sizes = '["30\"", "32\"", "34\"", "36\""]', 
    is_active = 1, 
    is_archived = 0, 
    video_url = NULL, 
    video_key = NULL 
WHERE id = 9750;

UPDATE products 
SET waist_sizes = '["30\"", "34\""]' 
WHERE id = 9752;

UPDATE products 
SET is_active = 1, 
    is_archived = 0, 
    video_url = NULL, 
    video_key = NULL, 
    video_mime_type = NULL, 
    video_poster_key = NULL,
    bust_sizes = '["32", "34", "36", "38"]'
WHERE id = 9755;

UPDATE products 
SET bust_sizes = '["32", "34", "36", "38"]' 
WHERE id = 9756;

-- Clean up any residual 'null' string literals on video columns
UPDATE products 
SET video_url = NULL 
WHERE video_url = 'null' OR video_url = 'undefined';

UPDATE products 
SET video_key = NULL 
WHERE video_key = 'null' OR video_key = 'undefined';

UPDATE products 
SET video_mime_type = NULL 
WHERE video_mime_type = 'null' OR video_mime_type = 'undefined';

UPDATE products 
SET video_poster_key = NULL 
WHERE video_poster_key = 'null' OR video_poster_key = 'undefined';
