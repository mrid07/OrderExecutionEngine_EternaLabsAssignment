import { Pool } from 'pg';
import { env } from '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';

export const pool = new Pool({
  host: env.PGHOST,
  port: env.PGPORT,
  database: env.PGDATABASE,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  ssl: false,
});

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log(`[PG] Connected as ${env.PGUSER}@${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}`);
  } catch (e: any) {
    console.error(
      '[PG] Connection FAILED:',
      e?.message || e,
      '\n[PG] Using ->',
      { host: env.PGHOST, port: env.PGPORT, db: env.PGDATABASE, user: env.PGUSER }
    );
    throw e;
  }
}

export async function migrate() {
  await testConnection();

  const dir = path.resolve('src/db/migrations');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    : [];

  if (files.length === 0) {
    console.log('[MIGRATE] No migration files found in', dir);
    return;
  }

  console.log('[MIGRATE] Applying', files.length, 'migration(s)');
  for (const f of files) {
    const full = path.join(dir, f);
    const sql = fs.readFileSync(full, 'utf8');
    console.log(`[MIGRATE] Running ${f}...`);
    await pool.query(sql);
    console.log(`[MIGRATE] Done ${f}`);
  }
  console.log('[MIGRATE] All migrations applied');
}
