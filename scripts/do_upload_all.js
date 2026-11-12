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

// 2. Read products data
const productsData = JSON.parse(fs.readFileSync('scripts/products_data.json', 'utf8'));

// Define mapping of original image filename to clean R2 key filename
const imageKeyMap = {
  'Mint Short Party Dress.jpg': 'mint_short_party_dress.jpg',
  'Pink Wedding Guest Dress.jpg': 'pink_wedding_guest_dress.jpg',
  'Short_Party_Dress.jpg': 'black_short_party_dress.jpg',
  'Silver Sequin Dinner Dress.jpg': 'silver_sequin_dinner_dress.jpg',
  'Nude Floral Dress.jpg': 'nude_floral_dress.jpg',
  'Black Party Dress.jpg': 'black_party_dress_7.jpg',
  'Black Long Dress.jpg': 'black_long_dress.jpg',
  'Multicolour Free-Size Party Dress.jpg': 'multicolour_free_size_party_dress.jpg',
  '10_mannequin_carved_L2_522275_0.jpg': 'floral_print_party_dress_10.jpg',
  'White Floral Party Dress.jpg': 'white_floral_party_dress.jpg',
  'White Dress.jpg': 'white_dress.jpg',
  'Maroon _ Black Occasion Dress.jpg': 'maroon_black_occasion_dress.jpg',
  'Red Dinner Dress.jpg': 'red_dinner_dress.jpg',
  'White Party Dress.jpg': 'white_party_dress_16.jpg',
  'White Parrty Dress.jpg': 'white_party_dress_17.jpg',
  'Green Party Dress.jpg': 'green_party_dress.jpg',
  'Black Peach_Party_Dress.jpg': 'black_peach_party_dress.jpg',
  'Nude Dinner Dress.jpg': 'nude_dinner_dress.jpg',
  'Nude 2 Dinner Dress.jpg': 'nude_2_dinner_dress.jpg',
  'Luminous Green Party Dress.jpg': 'luminous_green_party_dress_22.jpg',
  'Purple Free-Size Dinner Dress.jpg': 'purple_free_size_dinner_dress.jpg',
  'White Party Dress 24.jpg': 'white_dinner_dress_24.jpg',
  'Luminous Green Party Dress 25.jpg': 'luminous_green_party_dress_25.jpg',
  'Nude Floral Party Dress.jpg': 'nude_floral_party_dress.jpg',
  'Black Dinner Dress.jpg': 'black_dinner_dress.jpg',
  'Pink _ Red Party Dress.jpg': 'pink_red_party_dress.jpg',
  'Nude Party Dress.jpg': 'nude_party_dress.jpg',
  'Sky Blue Party Dress.jpg': 'sky_blue_party_dress.jpg',
  'White Free-Size Evening Dress.jpg': 'white_free_size_evening_dress.jpg',
  'White Evening Dress.jpg': 'white_evening_dress.jpg',
  'White Floral Shirt Dress.jpg': 'white_floral_shirt_dress.jpg',
  'White Party Dress 36.jpg': 'white_party_dress_36.jpg',
  'White Shirt  Dress.jpg': 'white_shirt_dress_37.jpg',
  'Black Floral Dinner Dress.jpg': 'black_floral_dinner_dress.jpg',
  'White Party Dress 41.jpg': 'white_party_dress_41.jpg',
  'Black Evening Dress.jpg': 'black_evening_dress.jpg',
  'Yellow Long_church_dress.jpg': 'yellow_long_church_dress.jpg',
  'White _ Blue _ White _ Green Striped Party Dress.jpg': 'white_blue_green_striped_party_dress.jpg',
  'Yellow Occasion Dress.jpg': 'yellow_occasion_dress.jpg',
  'Black Party Dress 72.jpg': 'black_party_dress_72.jpg',
  'Black & Gold Sequin Party Dress.jpg': 'black_gold_sequin_party_dress.jpg',
  'White Occasion Dress 74.jpg': 'white_occasion_dress_74.jpg',
  'Blue Floral Occasion Dress.jpg': 'blue_floral_occasion_dress.jpg',
  'Black _ Red Party Dress.jpg': 'black_red_party_dress_76.jpg'
};

// Ensure uploads/products exists and copy files locally
const uploadsDir = path.join(__dirname, '..', 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log('1. Copying images locally to uploads/products...');
for (const [origFile, cleanFile] of Object.entries(imageKeyMap)) {
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
console.log('Local image copy complete.');

// Upload to R2 in pool
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
  console.log(`2. Uploading ${items.length} images to Cloudflare R2 bucket "${R2_BUCKET}"...`);
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await uploadToR2(item.origFile, item.cleanFile);
    }
  });
  await Promise.all(workers);
  console.log('All images uploaded to Cloudflare R2 successfully!');
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
  console.log('3. Inserting products and variants into Cloudflare D1 database...');

  // Sort orders numerically
  const orders = Object.keys(productsData).map(Number).sort((a, b) => a - b);
  
  for (const order of orders) {
    const prod = productsData[order];
    const mainImgOrig = prod.images[0];
    const mainImgClean = imageKeyMap[mainImgOrig];
    const mediaRef = `products/${mainImgClean}`;
    const imageUrl = `${MEDIA_BASE}/${mediaRef}`;

    // Clean SKU
    const sku = `AF-DRE-${order}-${Date.now().toString().slice(-4)}`;
    const sizesJson = JSON.stringify(prod.sizes);
    const colorsJson = JSON.stringify(prod.colors);
    const description = `${prod.title} — beautifully tailored ${prod.subcategory.toLowerCase()} featuring ${prod.colors.join(' & ')} tones. Available sizes: ${prod.sizes.join(', ')}.`;

    // 1. Check if product already exists with this primary media reference to avoid duplicates
    const checkRes = await queryD1(`SELECT id FROM products WHERE media_reference = ${escapeSql(mediaRef)} AND is_archived = 0 LIMIT 1;`);
    let productId;

    if (checkRes.results && checkRes.results.length > 0) {
      productId = checkRes.results[0].id;
      console.log(`Product "${prod.title}" already exists (ID: ${productId}), updating...`);
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
      console.log(`Created product "${prod.title}" (ID: ${productId})`);
    }

    // 2. Insert/Update Product Media
    await queryD1(`DELETE FROM product_media WHERE product_id = ${productId};`);
    for (let i = 0; i < prod.images.length; i++) {
      const imgOrig = prod.images[i];
      const imgClean = imageKeyMap[imgOrig];
      const ref = `products/${imgClean}`;
      const isMain = i === 0 ? 1 : 0;
      await queryD1(`
        INSERT INTO product_media (product_id, media_type, media_reference, is_main, sort_order, created_at)
        VALUES (${productId}, 'image', ${escapeSql(ref)}, ${isMain}, ${i}, datetime('now'));
      `);
    }

    // 3. Insert/Update Variants & Inventory
    await queryD1(`DELETE FROM inventory WHERE product_id = ${productId};`);
    await queryD1(`DELETE FROM product_variants WHERE product_id = ${productId};`);

    for (const v of prod.variants) {
      for (const col of prod.colors) {
        const vSku = `AF-DRE-${productId}-${v.size.replace(/[^A-Za-z0-9]/g, '')}-${col.replace(/[^A-Za-z0-9]/g, '')}`;
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
  }

  console.log('Database synchronization complete!');
}

async function main() {
  try {
    const uploadItems = Object.entries(imageKeyMap).map(([origFile, cleanFile]) => ({ origFile, cleanFile }));
    await runUploadPool(uploadItems, 4);
    await syncDatabase();
    console.log('\n=== ALL UPLOADS & SYNCS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  }
}

main();