import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString && !process.env.PGHOST) {
  console.warn('Supabase database is not configured. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD in backend/.env.');
}

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pgPool = new Pool(poolConfig);
pgPool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));

const primaryKeys = {
  roles: 'role_id', users: 'user_id', departments: 'department_id', patients: 'patient_id',
  doctors: 'doctor_id', doctor_schedules: 'schedule_id', appointments: 'appointment_id',
  medical_records: 'record_id', medications: 'medication_id', prescriptions: 'prescription_id',
  prescription_items: 'prescription_item_id', invoices: 'invoice_id', invoice_items: 'invoice_item_id',
  payments: 'payment_id', bills: 'bill_id', appointment_audit: 'audit_id', invoice_item_audit: 'audit_id',
};

function translateSql(sql, params = []) {
  let index = 0;
  let translated = sql.replace(/\?/g, () => `$${++index}`);
  // MySQL's boolean SUM(expression) is not supported in PostgreSQL.
  translated = translated.replace(/SUM\(status\s*=\s*'([^']+)'\)/gi, "SUM(CASE WHEN status = '$1' THEN 1 ELSE 0 END)");
  return { sql: translated, params };
}

async function run(client, sql, params = []) {
  const trimmed = sql.trim();
  const isInsert = /^INSERT\s+INTO\s+/i.test(trimmed);
  let workingSql = trimmed;
  let returnKey = null;

  if (isInsert && !/\bRETURNING\b/i.test(workingSql)) {
    const match = workingSql.match(/^INSERT\s+INTO\s+([a-z_][a-z0-9_]*)/i);
    const table = match?.[1]?.toLowerCase();
    returnKey = primaryKeys[table] || null;
    if (returnKey) workingSql += ` RETURNING ${returnKey}`;
  }

  const translated = translateSql(workingSql, params);
  const result = await client.query(translated.sql, translated.params);

  if (isInsert) {
    const insertedId = returnKey && result.rows[0] ? result.rows[0][returnKey] : undefined;
    return [{ insertId: insertedId, affectedRows: result.rowCount || 0, rows: result.rows }];
  }
  if (/^(UPDATE|DELETE)\s+/i.test(trimmed)) {
    return [{ affectedRows: result.rowCount || 0, rowCount: result.rowCount || 0 }];
  }
  return [result.rows, result.fields];
}

function wrapClient(client, releaseClient = false) {
  return {
    query: (sql, params = []) => run(client, sql, params),
    execute: (sql, params = []) => run(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => { if (releaseClient) client.release(); },
  };
}

export const pool = {
  query: (sql, params = []) => run(pgPool, sql, params),
  execute: (sql, params = []) => run(pgPool, sql, params),
  getConnection: async () => wrapClient(await pgPool.connect(), true),
  end: () => pgPool.end(),
  rawPool: pgPool,
};

export async function checkDatabaseConnection() {
  const result = await pgPool.query('SELECT current_database() AS database, NOW() AS server_time');
  return result.rows[0];
}
