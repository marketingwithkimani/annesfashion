const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const sql = process.argv[2] || "SELECT id, title, price, category, subcategory, sku, image_url, media_reference, sizes, colors, total_stock FROM products WHERE category = 'dresses' ORDER BY id DESC LIMIT 5;";

const postData = JSON.stringify({ sql });

const req = https.request({
  hostname: 'api.cloudflare.com',
  path: `/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_PRODUCTION_ID}/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log(JSON.stringify(data.result[0].results, null, 2));
    } catch (e) {
      console.log(body);
    }
  });
});
req.on('error', console.error);
req.write(postData);
req.end();

