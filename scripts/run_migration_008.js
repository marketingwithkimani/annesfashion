#!/usr/bin/env node
/**
 * Migration 0008: Admin Leads & Settings tables
 * Runs SQL against Cloudflare D1 via REST API
 */

const fs = require('fs');

let API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
let ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'b4316201bd84751a7e7b3e43f5461c1f';
let DB_ID = process.env.D1_PRODUCTION_ID || 'b0b177b0-9783-4ce1-9eb5-1a8644a14bcb';

if (!API_TOKEN && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      if (m[1].trim() === 'CLOUDFLARE_API_TOKEN') API_TOKEN = m[2].trim();
      if (m[1].trim() === 'CLOUDFLARE_ACCOUNT_ID') ACCOUNT_ID = m[2].trim();
      if (m[1].trim() === 'D1_PRODUCTION_ID') DB_ID = m[2].trim();
    }
  });
}

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;

async function runSQL(sql, label) {
  console.log(`\n▶ ${label}`);
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  const data = await response.json();
  if (!response.ok || (data.errors && data.errors.length > 0)) {
    console.error(`  ✗ FAILED (HTTP ${response.status}):`, JSON.stringify(data.errors || data, null, 2));
    return false;
  }
  console.log(`  ✓ SUCCESS`);
  if (data.result && data.result[0]) {
    console.log(`  meta:`, JSON.stringify(data.result[0].meta || {}));
  }
  return true;
}

async function main() {
  console.log('=== Migration 0008: admin_leads_settings ===');
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log(`DB:      ${DB_ID}`);

  const steps = [
    {
      label: 'CREATE TABLE leads',
      sql: `CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK(category IN ('corporate', 'corporate_women', 'diaspora')),
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  website TEXT,
  notes TEXT,
  email_draft TEXT,
  email_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`,
    },
    {
      label: 'CREATE TABLE analytics_events',
      sql: `CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  page TEXT,
  product_id INTEGER,
  session_id TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`,
    },
    {
      label: 'CREATE TABLE settings (if not exists)',
      sql: `CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
)`,
    },
    {
      label: "INSERT default setting: hot_picks_mode",
      sql: `INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('hot_picks_mode', 'normal')`,
    },
    {
      label: "INSERT default setting: pre_order_mode",
      sql: `INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('pre_order_mode', 'off')`,
    },
    {
      label: "INSERT default setting: flash_sale_mode",
      sql: `INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('flash_sale_mode', 'off')`,
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const step of steps) {
    const ok = await runSQL(step.sql, step.label);
    if (ok) passed++; else failed++;
  }

  console.log(`\n=== Done: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
