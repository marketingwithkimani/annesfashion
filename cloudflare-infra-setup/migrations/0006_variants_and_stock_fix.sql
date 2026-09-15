-- Migration 0006: Ensure created_at in product_variants and seed variants/inventory for product 9762

-- 1. Ensure product_variants table has created_at column (without non-constant default)
ALTER TABLE product_variants ADD COLUMN created_at TEXT;

-- 2. Insert variants for Product 9762 (Fine Linen Dress)
-- Size 34" White (qty 2), Size 38" White (qty 3), Size 34" Pink (qty 2), Size 38" Pink (qty 3)
INSERT OR IGNORE INTO product_variants (product_id, size, color, sku, is_active, created_at) VALUES
(9762, '34"', 'White', 'AF-DRE-714725-34-WHI', 1, datetime('now')),
(9762, '38"', 'White', 'AF-DRE-714725-38-WHI', 1, datetime('now')),
(9762, '34"', 'Pink', 'AF-DRE-714725-34-PNK', 1, datetime('now')),
(9762, '38"', 'Pink', 'AF-DRE-714725-38-PNK', 1, datetime('now'));

-- 3. Seed inventory quantities for these variants
INSERT OR REPLACE INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
SELECT 9762, id, 
  CASE 
    WHEN size = '34"' AND color = 'White' THEN 2
    WHEN size = '38"' AND color = 'White' THEN 3
    WHEN size = '34"' AND color = 'Pink' THEN 2
    WHEN size = '38"' AND color = 'Pink' THEN 3
    ELSE 2
  END, 
  0, 5, datetime('now')
FROM product_variants 
WHERE product_id = 9762;

-- 4. Set total_stock on products table to 10
UPDATE products SET total_stock = 10 WHERE id = 9762;
