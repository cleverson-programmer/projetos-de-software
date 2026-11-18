import pg from 'pg';

const { Pool } = pg;
let pool = null;

export function getDatabase() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL para conectar ao PostgreSQL.');
    const config = {
      connectionString: process.env.DATABASE_URL,
      max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
    };
    if (process.env.DATABASE_SCHEMA) {
      if (!/^[a-z_][a-z0-9_]*$/.test(process.env.DATABASE_SCHEMA)) throw new Error('DATABASE_SCHEMA inválido.');
      config.options = '-c search_path=' + process.env.DATABASE_SCHEMA;
    }
    pool = new Pool(config);
    pool.on('error', (error) => console.error('Erro em conexão PostgreSQL ociosa:', error.code || 'DATABASE_ERROR'));
  }
  return pool;
}

/** Toda a transação usa o MESMO cliente, inclusive rollback e liberação. */
export async function withTransaction(callback) {
  const client = await getDatabase().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  const current = pool;
  pool = null;
  if (current) await current.end();
}
