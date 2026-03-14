import { Pool, PoolClient, QueryResult } from 'pg';

declare global {
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err);
  });

  return pool;
}

// Reuse pool across hot-reloads in development
const pool = global._pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') global._pgPool = pool;

export { pool };

// ─── Typed query helper ──────────────────────────────────────
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    if (process.env.NODE_ENV === 'development') {
      const dur = Date.now() - start;
      if (dur > 200) console.warn(`[DB SLOW ${dur}ms]`, text.slice(0, 80));
    }
    return res;
  } catch (err: any) {
    console.error('[DB] Query error:', err.message, '\nQuery:', text.slice(0, 120));
    throw err;
  }
}

// ─── Transaction helper ──────────────────────────────────────
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Health check ────────────────────────────────────────────
export async function dbHealthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
