import * as dotenv from 'dotenv';
dotenv.config();

function num(v: string | undefined, d: number) {
  const s = (v ?? '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : d;
}
function str(v: string | undefined, d: string) {
  const s = (v ?? '').trim();
  return s.length ? s : d;
}

export const env = {
  PORT: num(process.env.PORT, 3000),

  REDIS_HOST: str(process.env.REDIS_HOST, '127.0.0.1'),
  REDIS_PORT: num(process.env.REDIS_PORT, 6379),

  PGHOST: str(process.env.PGHOST, '127.0.0.1'),
  PGPORT: num(process.env.PGPORT, 5432),
  PGDATABASE: str(process.env.PGDATABASE, 'oee'),
  PGUSER: str(process.env.PGUSER, 'oee'),
  PGPASSWORD: str(process.env.PGPASSWORD, 'oee'),

  QUEUE_NAME: str(process.env.QUEUE_NAME, 'orders'),
  CONCURRENCY: num(process.env.CONCURRENCY, 10),
};