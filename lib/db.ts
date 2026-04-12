import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function numEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sslConfig(): mysql.PoolOptions['ssl'] {
  const raw = String(process.env.DB_SSL || '').trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'false' || raw === 'no') return undefined;

  const rejectUnauthorizedRaw = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '').trim().toLowerCase();
  const rejectUnauthorized = !(rejectUnauthorizedRaw === '0' || rejectUnauthorizedRaw === 'false' || rejectUnauthorizedRaw === 'no');

  return { rejectUnauthorized };
}

export function getPool() {
  if (!pool) {
    const socketPath = String(process.env.DB_SOCKET || '').trim();

    pool = mysql.createPool({
      ...(socketPath
        ? { socketPath }
        : {
            host: process.env.DB_HOST || '127.0.0.1',
            port: numEnv(process.env.DB_PORT, 3306),
          }),
      user: process.env.DB_USER || '',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || '',
      waitForConnections: true,
      connectionLimit: numEnv(process.env.DB_POOL_LIMIT, 8),
      queueLimit: 0,
      connectTimeout: numEnv(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: sslConfig(),
    });
  }
  return pool;
}
