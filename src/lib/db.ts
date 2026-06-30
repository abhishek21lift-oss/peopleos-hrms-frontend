import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
      throw new Error('SUPABASE_DB_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
      query_timeout: 20000,
    });
    pool.on('error', (err) => {
      console.error('Unexpected DB pool error:', err.message);
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } catch (err) {
    console.error('DB query failed:', (err as Error).message);
    throw err;
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(text: string, params?: any[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(text, params);
  } catch (err) {
    console.error('DB execute failed:', (err as Error).message);
    throw err;
  } finally {
    client.release();
  }
}
