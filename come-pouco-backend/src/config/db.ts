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

const ensureDatabaseSchema = async (): Promise<void> => {
  const createAffiliateLinksTableQuery = `
    CREATE TABLE IF NOT EXISTS affiliate_links (
      id SERIAL PRIMARY KEY,
      original_link TEXT NOT NULL,
      product_image TEXT NOT NULL,
      catchy_phrase VARCHAR(255) NOT NULL,
      affiliate_link TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await pool.query(createAffiliateLinksTableQuery);
};

export { ensureDatabaseSchema, pool, checkDatabaseConnection };
