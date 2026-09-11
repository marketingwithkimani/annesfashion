const https = require('https');

const SUPABASE_URL = 'https://yteejssnesajnuibfacx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l-fKjBTzFUvE__qQrQEZRw_V2_2LAmv';

function get(table) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
  });
}

async function test() {
  const tables = ['products', 'product_variants', 'inventory', 'product_images', 'settings', 'customers', 'sales', 'sale_items'];
  for (const t of tables) {
    const res = await get(t);
    console.log(`Table ${t}: status=${res.status}, count=${Array.isArray(res.data) ? res.data.length : 'not array'}`);
    if (Array.isArray(res.data) && res.data.length > 0) {
      console.log(` Sample keys in ${t}:`, Object.keys(res.data[0]));
    }
  }
}

test();
