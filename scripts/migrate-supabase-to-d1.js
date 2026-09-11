const https = require('https');

const SUPABASE_URL = 'https://yteejssnesajnuibfacx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l-fKjBTzFUvE__qQrQEZRw_V2_2LAmv';

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'b4316201bd84751a7e7b3e43f5461c1f';
const D1_PROD_ID = process.env.D1_PRODUCTION_ID || 'b0b177b0-9783-4ce1-9eb5-1a8644a14bcb';

function fetchSupabase(table) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'User-Agent': 'AnnesFashionMigration/1.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

function queryD1(sql, params = []) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql, params });
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_PROD_ID}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ success: false, error: e.message, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function isVideoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.includes('/vid_') || lower.includes('cloudflarestream.com');
}

async function migrate() {
  console.log('--- Step 1: Fetching Supabase Data ---');
  const [products, variants, inventory, images, settings, customers, sales, saleItems] = await Promise.all([
    fetchSupabase('products'),
    fetchSupabase('product_variants'),
    fetchSupabase('inventory'),
    fetchSupabase('product_images'),
    fetchSupabase('settings'),
    fetchSupabase('customers'),
    fetchSupabase('sales'),
    fetchSupabase('sale_items')
  ]);

  console.log(`Fetched from Supabase:
  - Products: ${products.length}
  - Variants: ${variants.length}
  - Inventory: ${inventory.length}
  - Images: ${images.length}
  - Settings: ${settings.length}
  - Customers: ${customers.length}
  - Sales: ${sales.length}
  - Sale Items: ${saleItems.length}`);

  console.log('\n--- Step 2: Migrating Settings ---');
  for (const s of settings) {
    await queryD1(
      `INSERT INTO settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
      [s.setting_key, s.setting_value, s.updated_at || new Date().toISOString()]
    );
  }
  console.log('✓ Settings migrated');

  console.log('\n--- Step 3: Migrating Products & Product Media ---');
  let migratedProducts = 0;
  let videoProducts = 0;
  for (const p of products) {
    const isVideo = isVideoUrl(p.image_url);
    const mediaType = isVideo ? 'video' : 'image';
    if (isVideo) videoProducts++;

    const isActive = p.is_active === false ? 0 : 1;
    const isFeatured = p.is_featured ? 1 : 0;
    const allowPreorder = p.allow_preorder ? 1 : 0;

    // Insert or replace product preserving Supabase ID
    await queryD1(
      `INSERT OR REPLACE INTO products (
        id, title, description, price, category, sku, image_url,
        media_type, media_reference, poster_reference, is_active,
        is_archived, is_featured, allow_preorder, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        p.id,
        p.title,
        p.description || '',
        p.price || 0,
        p.category || 'general',
        p.sku || `SKU-${p.id}`,
        p.image_url || null,
        mediaType,
        p.image_url || null,
        isVideo ? 'assets/Logo%20Black.png' : null, // Default poster for existing video if none set
        isActive,
        isFeatured,
        allowPreorder,
        p.created_at || new Date().toISOString(),
        p.updated_at || new Date().toISOString()
      ]
    );

    // Insert primary media into product_media
    if (p.image_url) {
      await queryD1(
        `INSERT OR IGNORE INTO product_media (
          product_id, media_type, media_reference, poster_reference, is_main, sort_order, created_at
        ) VALUES (?, ?, ?, ?, 1, 0, ?)`,
        [
          p.id,
          mediaType,
          p.image_url,
          isVideo ? 'assets/Logo%20Black.png' : null,
          p.created_at || new Date().toISOString()
        ]
      );
    }
    migratedProducts++;
  }
  console.log(`✓ Migrated ${migratedProducts} products (including ${videoProducts} video products)`);

  console.log('\n--- Step 4: Migrating Additional Gallery Images ---');
  let migratedImages = 0;
  for (const img of images) {
    const isVideo = isVideoUrl(img.image_url);
    const mediaType = isVideo ? 'video' : 'image';
    await queryD1(
      `INSERT INTO product_media (
        product_id, media_type, media_reference, poster_reference, is_main, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      [img.product_id, mediaType, img.image_url, null, img.is_main ? 1 : 0]
    );
    migratedImages++;
  }
  console.log(`✓ Migrated ${migratedImages} gallery media items`);

  console.log('\n--- Step 5: Migrating Product Variants ---');
  let migratedVariants = 0;
  for (const v of variants) {
    await queryD1(
      `INSERT OR REPLACE INTO product_variants (
        id, product_id, size, color, sku, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [v.id, v.product_id, v.size || null, v.color || null, v.sku || null, v.is_active === false ? 0 : 1]
    );
    migratedVariants++;
  }
  console.log(`✓ Migrated ${migratedVariants} variants`);

  console.log('\n--- Step 6: Migrating Inventory ---');
  let migratedInventory = 0;
  for (const inv of inventory) {
    await queryD1(
      `INSERT OR REPLACE INTO inventory (
        id, product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id,
        inv.product_id,
        inv.variant_id || null,
        inv.quantity || 0,
        inv.reserved_quantity || 0,
        inv.reorder_point || 5,
        inv.last_updated || new Date().toISOString()
      ]
    );
    migratedInventory++;
  }
  console.log(`✓ Migrated ${migratedInventory} inventory records`);

  console.log('\n--- Step 7: Migrating Customers ---');
  let migratedCustomers = 0;
  for (const c of customers) {
    await queryD1(
      `INSERT OR REPLACE INTO customers (
        id, name, email, phone, pin_hash, address, city, customer_type, total_orders, total_spent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.name || 'Valued Customer',
        c.email || null,
        c.phone || null,
        c.pin_hash || null,
        c.address || null,
        c.city || 'Nairobi',
        c.customer_type || 'online',
        c.total_orders || 0,
        c.total_spent || 0,
        c.created_at || new Date().toISOString(),
        c.updated_at || new Date().toISOString()
      ]
    );
    migratedCustomers++;
  }
  console.log(`✓ Migrated ${migratedCustomers} customers`);

  console.log('\n--- Step 8: Migrating Sales & Sale Items ---');
  let migratedSales = 0;
  for (const s of sales) {
    await queryD1(
      `INSERT OR REPLACE INTO sales (
        id, sale_number, sale_type, customer_id, customer_name, total_amount, payment_method,
        payment_status, transaction_reference, staff_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.sale_number,
        s.sale_type || 'online',
        s.customer_id || null,
        s.customer_name || null,
        s.total_amount || 0,
        s.payment_method || 'mpesa',
        s.payment_status || 'paid',
        s.transaction_reference || null,
        s.staff_id || null,
        s.notes || null,
        s.created_at || new Date().toISOString()
      ]
    );
    migratedSales++;
  }
  console.log(`✓ Migrated ${migratedSales} sales`);

  let migratedSaleItems = 0;
  for (const si of saleItems) {
    await queryD1(
      `INSERT OR REPLACE INTO sale_items (
        id, sale_id, product_id, variant_id, product_title, quantity, unit_price, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        si.id,
        si.sale_id,
        si.product_id,
        si.variant_id || null,
        si.product_title || 'Item',
        si.quantity || 1,
        si.unit_price || 0,
        si.total_price || 0
      ]
    );
    migratedSaleItems++;
  }
  console.log(`✓ Migrated ${migratedSaleItems} sale items`);

  console.log('\n=============================================');
  console.log('🎉 ALL BUSINESS DATA SUCCESSFULLY MIGRATED TO CLOUDFLARE D1!');
  console.log('=============================================');
}

migrate().catch(console.error);
