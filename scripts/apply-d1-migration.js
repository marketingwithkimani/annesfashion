const fs = require('fs');
const https = require('https');
const path = require('path');

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'b4316201bd84751a7e7b3e43f5461c1f';
const DB_IDS = [
  { name: 'client-production', id: 'b0b177b0-9783-4ce1-9eb5-1a8644a14bcb' },
  { name: 'client-development', id: '7c59e5a3-1257-43fe-9f1e-2b219b7ec697' }
];

const sqlFile = path.join(__dirname, '..', 'cloudflare-infra-setup', 'migrations', '0001_initial_schema.sql');
let rawSql = fs.readFileSync(sqlFile, 'utf8');

// Remove single-line comments (-- ...)
rawSql = rawSql.replace(/--.*$/gm, '');

// Split by semi-colon
const statements = rawSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Found ${statements.length} SQL statements to execute.`);

function queryD1(dbId, sqlStatement) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ sql: sqlStatement });
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database/${dbId}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
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

async function run() {
  for (const db of DB_IDS) {
    console.log(`\n=== Applying schema to ${db.name} (${db.id}) ===`);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      const res = await queryD1(db.id, stmt);
      if (res.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Error on statement #${i + 1}:`, stmt.substring(0, 60));
        console.error(JSON.stringify(res.errors || res));
      }
    }
    console.log(`Finished ${db.name}: ${successCount} succeeded, ${errorCount} failed.`);
  }
}

run().catch(console.error);
