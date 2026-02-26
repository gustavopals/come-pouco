import { Pool } from 'pg';

import env from './env';

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password
});

const checkDatabaseConnection = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

export { pool, checkDatabaseConnection };
