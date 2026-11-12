const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// 1. Read env
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID || 'b4316201bd84751a7e7b3e43f5461c1f';
const DB_ID = env.D1_PRODUCTION_ID || 'b0b177b0-9783-4ce1-9eb5-1a8644a14bcb';
const R2_BUCKET = env.R2_IMAGES_BUCKET || 'client-production-images';
const MEDIA_BASE = 'https://api.annesfashion.co.ke/media';

// 2. Read new products data
const newProductsData = JSON.parse(fs.readFileSync('scripts/new_products_data.json', 'utf8'));

// Image mapping from original filename in products/ to clean R2 key filename
const newImageKeyMap = {
  'Black Short Dinner Dress 89.jpg': 'black_short_dinner_dress_89.jpg',
  'Black _ Gold Short Party Dress.jpg': 'black_gold_short_party_dress.jpg',
  'Black _ Nude Dinner Dress.jpg': 'black_nude_dinner_dress.jpg',
  'Black _ Purple Dinner Dress.jpg': 'black_purple_dinner_dress.jpg',
  'Black _ Red _ Black _ Pink Sequin Dinner Dress.jpg': 'black_red_pink_sequin_dinner_dress.jpg',
  'Brown _ Green Shirt Dress.jpg': 'brown_green_shirt_dress.jpg',
  'Floral Dinner Dress 87.jpg': 'floral_dinner_dress_87.jpg',
  'Floral Long Church Dress.jpg': 'floral_long_church_dress.jpg',
  'Floral Occasion Dress 90.jpg': 'floral_occasion_dress_90.jpg',
  'Green _ Pink Occasion Dress.jpg': 'green_pink_occasion_dress.jpg',
  'Lilac Wedding Guest Dress.jpg': 'lilac_wedding_guest_dress.jpg',
  'Multicoloured Evening Dress 92.jpg': 'multicoloured_evening_dress_92.jpg',
  'Off-White Long Sequin Dress.jpg': 'off_white_long_sequin_dress.jpg',
  'Peach Dinner Dress 55.jpg': 'peach_dinner_dress_55.jpg',
  'Peach Dinner Dress 59.jpg': 'peach_dinner_dress_59.jpg',
  'Peach Dinner Dress.jpg': 'peach_dinner_dress_62.jpg',
  'Peach Short Dinner Dress.jpg': 'peach_short_dinner_dress.jpg',
  'Peach _ Green Dinner Dress.jpg': 'peach_green_dinner_dress.jpg',
  'Peach _ Pink Dinner Dress.jpg': 'peach_pink_dinner_dress.jpg',
  'Pink Dinner Dress 53.jpg': 'pink_dinner_dress_53.jpg',
  'Pink Dinner Dress.jpg': 'pink_dinner_dress_67.jpg',
  'Purple Dinner Dress.jpg': 'purple_dinner_dress.jpg',
  'Red Dinner Dress 79.jpg': 'red_dinner_dress_79.jpg',
  'Red Long Dinner Dress.jpg': 'red_long_dinner_dress.jpg',
  'Red Short Dinner Dress.jpg': 'red_short_dinner_dress.jpg',
  'Silkish Dinner Dress.jpg': 'silkish_dinner_dress.jpg',
  'Silver Evening Dress 81 _ 85.jpg': 'silver_evening_dress_85.jpg',
  'White Floral Evening Dress 91.jpg': 'white_floral_evening_dress_91.jpg',
  'White Floral Long Church Dress.jpg': 'white_floral_long_church_dress.jpg',
  'White Free-Size Long Church Dress.jpg': 'white_free_size_long_church_dress.jpg',
  'White Long Church Dress.jpg': 'white_long_church_dress_50.jpg',
  'White Short Evening Dress.jpg': 'white_short_evening_dress.jpg',
  'White _ Brown Office Wear.jpg': 'white_brown_office_wear.jpg',
  'White _ Orange Evening Dress.jpg': 'white_orange_evening_dress.jpg',
};

// Ensure uploads/products exists and copy files locally
const uploadsDir = path.join(__dirname, '..', 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log('1. Copying 34 new images locally to uploads/products...');
for (const [origFile, cleanFile] of Object.entries(newImageKeyMap)) {
  const src = path.join(__dirname, '..', 'products', origFile);
  const destClean = path.join(uploadsDir, cleanFile);
  const destOrig = path.join(uploadsDir, origFile);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, destClean);
    fs.copyFileSync(src, destOrig);
  } else {
    console.warn(`Warning: source file not found: ${src}`);
  }
}
console.log('Local copy complete.');

// Upload to Cloudflare R2
function uploadToR2(origFile, cleanFile) {
  return new Promise((resolve, reject) => {
    const srcPath = path.join('products', origFile);
    const r2Target = `${R2_BUCKET}/products/${cleanFile}`;
    const cmd = `npx --prefix worker wrangler r2 object put "${r2Target}" --file "${srcPath}" --content-type "image/jpeg"`;
    
    exec(cmd, { env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN } }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Failed to upload ${origFile}:`, stderr || err.message);
        reject(err);
      } else {
        console.log(`Uploaded to R2: products/${cleanFile}`);
        resolve();
      }
    });
  });
}

async function runUploadPool(items, concurrency = 4) {
  console.log(`2. Uploading ${items.length} new images to Cloudflare R2 bucket "${R2_BUCKET}"...`);
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await uploadToR2(item.origFile, item.cleanFile);
    }
  });
  await Promise.all(workers);
  console.log('All new images uploaded to Cloudflare R2 successfully!');
}

// D1 Query helper
function queryD1(sqlStatement) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql: sqlStatement });
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.success) {
            resolve(parsed.result[0]);
          } else {
            reject(new Error(JSON.stringify(parsed.errors)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function syncDatabase() {
  console.log('3. Inserting new products and variants into Cloudflare D1 database...');

  const orders = Object.keys(newProductsData).map(Number).sort((a, b) => a - b);
  const createdSummary = [];

  for (const order of orders) {
    const prod = newProductsData[order];
    const mainImgOrig = prod.images[0];
    const mainImgClean = newImageKeyMap[mainImgOrig];
    const mediaRef = `products/${mainImgClean}`;
    const imageUrl = `${MEDIA_BASE}/${mediaRef}`;

    const sku = `AF-DRE-${order}-${Date.now().toString().slice(-4)}`;
    const sizesJson = JSON.stringify(prod.sizes);
    const colorsJson = JSON.stringify(prod.colors);
    const description = `${prod.title} — beautifully styled ${prod.subcategory.toLowerCase()} in ${prod.colors.join(' & ')} tones. Available sizes: ${prod.sizes.join(', ')}.`;

    // Check if product already exists with this primary media reference
    const checkRes = await queryD1(`SELECT id FROM products WHERE media_reference = ${escapeSql(mediaRef)} AND is_archived = 0 LIMIT 1;`);
    let productId;

    if (checkRes.results && checkRes.results.length > 0) {
      productId = checkRes.results[0].id;
      console.log(`Product #${order} "${prod.title}" already exists (ID: ${productId}), updating...`);
      await queryD1(`
        UPDATE products SET
          price = ${prod.price},
          category = 'dresses',
          subcategory = ${escapeSql(prod.subcategory)},
          image_url = ${escapeSql(imageUrl)},
          media_type = 'image',
          media_reference = ${escapeSql(mediaRef)},
          sizes = ${escapeSql(sizesJson)},
          colors = ${escapeSql(colorsJson)},
          total_stock = ${prod.total_stock},
          is_active = 1,
          is_archived = 0,
          updated_at = datetime('now')
        WHERE id = ${productId};
      `);
    } else {
      const insRes = await queryD1(`
        INSERT INTO products (
          title, description, price, category, subcategory, sku,
          image_url, media_type, media_reference,
          sizes, colors, total_stock,
          is_active, is_archived, is_featured, allow_preorder, is_flash_sale,
          created_at, updated_at
        ) VALUES (
          ${escapeSql(prod.title)},
          ${escapeSql(description)},
          ${prod.price},
          'dresses',
          ${escapeSql(prod.subcategory)},
          ${escapeSql(sku)},
          ${escapeSql(imageUrl)},
          'image',
          ${escapeSql(mediaRef)},
          ${escapeSql(sizesJson)},
          ${escapeSql(colorsJson)},
          ${prod.total_stock},
          1, 0, 0, 0, 0,
          datetime('now'), datetime('now')
        ) RETURNING id;
      `);
      productId = insRes.results[0].id;
      console.log(`Created product #${order} "${prod.title}" (ID: ${productId})`);
    }

    // Insert Product Media
    await queryD1(`DELETE FROM product_media WHERE product_id = ${productId};`);
    for (let i = 0; i < prod.images.length; i++) {
      const imgOrig = prod.images[i];
      const imgClean = newImageKeyMap[imgOrig];
      const ref = `products/${imgClean}`;
      const isMain = i === 0 ? 1 : 0;
      await queryD1(`
        INSERT INTO product_media (product_id, media_type, media_reference, is_main, sort_order, created_at)
        VALUES (${productId}, 'image', ${escapeSql(ref)}, ${isMain}, ${i}, datetime('now'));
      `);
    }

    // Insert Variants & Inventory
    await queryD1(`DELETE FROM inventory WHERE product_id = ${productId};`);
    await queryD1(`DELETE FROM product_variants WHERE product_id = ${productId};`);

    for (const v of prod.variants) {
      for (const col of prod.colors) {
        const cleanSize = v.size.replace(/[^A-Za-z0-9]/g, '');
        const cleanCol = col.replace(/[^A-Za-z0-9]/g, '');
        const vSku = `AF-DRE-${productId}-${cleanSize}-${cleanCol}`;
        const varRes = await queryD1(`
          INSERT INTO product_variants (product_id, size, color, sku, is_active, created_at)
          VALUES (${productId}, ${escapeSql(v.size)}, ${escapeSql(col)}, ${escapeSql(vSku)}, 1, datetime('now'))
          RETURNING id;
        `);
        const variantId = varRes.results[0].id;
        await queryD1(`
          INSERT INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
          VALUES (${productId}, ${variantId}, ${v.qty}, 0, 5, datetime('now'));
        `);
      }
    }

    createdSummary.push({
      order,
      productId,
      title: prod.title,
      price: prod.price,
      sizes: prod.sizes,
      total_stock: prod.total_stock,
      imageUrl
    });
  }

  // Update combined products_data.json
  const prevProductsData = fs.existsSync('scripts/products_data.json')
    ? JSON.parse(fs.readFileSync('scripts/products_data.json', 'utf8'))
    : {};
  const mergedProducts = { ...prevProductsData, ...newProductsData };
  fs.writeFileSync('scripts/products_data.json', JSON.stringify(mergedProducts, null, 2));
  fs.writeFileSync('scripts/upload_summary_latest.json', JSON.stringify(createdSummary, null, 2));

  console.log(`Database sync complete. Total new products created/synced: ${createdSummary.length}`);
}

async function main() {
  try {
    const uploadItems = Object.entries(newImageKeyMap).map(([origFile, cleanFile]) => ({ origFile, cleanFile }));
    await runUploadPool(uploadItems, 4);
    await syncDatabase();
    console.log('\n=== ALL NEW UPLOADS & SYNCS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  }
}

main();

