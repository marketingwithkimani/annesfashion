/**
 * Automated D1 Backup — scheduled() cron handler for client-api Worker
 * 
 * Runs daily at 2:00 AM UTC (configurable in wrangler.jsonc triggers.crons).
 * Exports all D1 tables as a SQL dump and writes to env.BACKUPS (R2 bucket:
 * client-production-backups).
 * 
 * Cron Triggers execute on UTC time.
 * The Worker runtime waits up to 15 minutes for the scheduled handler to complete.
 * 
 * IMPORTANT: There is currently a minor Cloudflare incident affecting Workers
 * Cron Triggers. Deploy this, but monitor the Cron Events tab in the dashboard
 * until the incident resolves: https://www.cloudflarestatus.com/incidents/sjs8s0q2x4hw
 */

// All tables in the production D1 database, in dependency order
// (parents before children to avoid FK issues on restore)
const BACKUP_TABLES = [
  'users',
  'customers',
  'products',
  'product_variants',
  'inventory',
  'product_media',
  'sales',
  'sale_items',
  'inventory_logs',
  'settings',
  'chat_conversations',
  'chat_messages',
];

/**
 * Escapes a value for safe inclusion in a SQL INSERT statement.
 * Handles null, numbers, booleans, and strings.
 */
function escapeSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  // String — escape single quotes by doubling them
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Builds a SQL dump for a single table.
 * Outputs DELETE + INSERT statements.
 */
async function dumpTable(env, tableName) {
  const result = await env.DB.prepare(`SELECT * FROM ${tableName}`).all();

  let sql = `-- Table: ${tableName}\n`;
  sql += `DELETE FROM ${tableName};\n`;

  if (!result.results || result.results.length === 0) {
    sql += `-- (empty)\n\n`;
    return sql;
  }

  const columns = Object.keys(result.results[0]);
  const columnList = columns.join(', ');

  for (const row of result.results) {
    const values = columns.map((col) => escapeSqlValue(row[col])).join(', ');
    sql += `INSERT INTO ${tableName} (${columnList}) VALUES (${values});\n`;
  }

  sql += '\n';
  return sql;
}

/**
 * Main backup function — called by the scheduled() handler.
 * Exports all tables and writes the SQL dump to R2.
 */
async function performBackup(env) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupKey = `d1-backups/client-production/${timestamp}.sql`;

  let sqlDump = `-- Anne's Fashion D1 Backup\n`;
  sqlDump += `-- Database: client-production\n`;
  sqlDump += `-- Timestamp: ${new Date().toISOString()}\n`;
  sqlDump += `-- Tables: ${BACKUP_TABLES.length}\n\n`;
  sqlDump += `PRAGMA foreign_keys=OFF;\n\n`;

  let totalRows = 0;
  const tableStats = {};

  for (const table of BACKUP_TABLES) {
    try {
      const tableSql = await dumpTable(env, table);
      sqlDump += tableSql;

      // Count rows for the report
      const countResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM ${table}`
      ).first();
      const rowCount = countResult?.count || 0;
      tableStats[table] = rowCount;
      totalRows += rowCount;
    } catch (err) {
      console.error(`Error backing up table ${table}:`, err);
      sqlDump += `-- ERROR backing up ${table}: ${err.message}\n\n`;
      tableStats[table] = 'ERROR';
    }
  }

  sqlDump += `PRAGMA foreign_keys=ON;\n`;
  sqlDump += `-- Backup complete\n`;

  // Write to R2 backups bucket
  await env.BACKUPS.put(backupKey, sqlDump, {
    httpMetadata: { contentType: 'application/sql' },
    customMetadata: {
      database: 'client-production',
      tables: String(BACKUP_TABLES.length),
      totalRows: String(totalRows),
      createdAt: new Date().toISOString(),
    },
  });

  console.log(`Backup completed: ${backupKey} (${totalRows} rows)`);

  return { backupKey, totalRows, tableStats };
}

/**
 * Scheduled handler — invoked by the Cron Trigger.
 * Add this to your Worker's default export alongside the fetch handler.
 *
 * In your main Worker file (src/index.js):
 *
 *   export default {
 *     async fetch(request, env, ctx) {
 *       // ... your existing fetch handler
 *     },
 *
 *     async scheduled(controller, env, ctx) {
 *       // Import and call the backup
 *       const { performBackup } = require('./backup-handler');
 *       ctx.waitUntil(performBackup(env));
 *     },
 *   };
 */
async function scheduled(controller, env, ctx) {
  // controller.cron contains the cron expression that triggered this event
  // controller.scheduledTime contains the scheduled time in ms since epoch

  console.log(`Cron triggered: ${controller.cron} at ${new Date(controller.scheduledTime).toISOString()}`);

  const result = await performBackup(env);
  console.log('Backup result:', JSON.stringify(result));
}

module.exports = { scheduled, performBackup, BACKUP_TABLES };
