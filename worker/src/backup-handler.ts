import { Env } from './types';

export const BACKUP_TABLES = [
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

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function dumpTable(env: Env, tableName: string): Promise<string> {
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
    const values = columns.map((col) => escapeSqlValue((row as any)[col])).join(', ');
    sql += `INSERT INTO ${tableName} (${columnList}) VALUES (${values});\n`;
  }

  sql += '\n';
  return sql;
}

export async function performBackup(env: Env): Promise<{ backupKey: string; totalRows: number; tableStats: Record<string, any> }> {
  if (!env.BACKUPS) {
    throw new Error('BACKUPS R2 bucket binding is not configured.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupKey = `d1-backups/client-production/${timestamp}.sql`;

  let sqlDump = `-- Anne's Fashion D1 Backup\n`;
  sqlDump += `-- Database: client-production\n`;
  sqlDump += `-- Timestamp: ${new Date().toISOString()}\n`;
  sqlDump += `-- Tables: ${BACKUP_TABLES.length}\n\n`;
  sqlDump += `PRAGMA foreign_keys=OFF;\n\n`;

  let totalRows = 0;
  const tableStats: Record<string, any> = {};

  for (const table of BACKUP_TABLES) {
    try {
      const tableSql = await dumpTable(env, table);
      sqlDump += tableSql;

      const countResult = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM ${table}`
      ).first<{ count: number }>();
      const rowCount = countResult?.count || 0;
      tableStats[table] = rowCount;
      totalRows += rowCount;
    } catch (err: any) {
      console.error(`Error backing up table ${table}:`, err);
      sqlDump += `-- ERROR backing up ${table}: ${err.message}\n\n`;
      tableStats[table] = 'ERROR';
    }
  }

  sqlDump += `PRAGMA foreign_keys=ON;\n`;
  sqlDump += `-- Backup complete\n`;

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
