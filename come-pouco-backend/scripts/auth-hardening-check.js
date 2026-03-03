const { Client } = require('pg');

const requiredColumns = [
  'username',
  'two_factor_enabled',
  'two_factor_secret',
  'two_factor_secret_pending',
  'two_factor_pending_created_at',
  'two_factor_confirmed_at'
];

(async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'come_pouco_user',
    password: process.env.DB_PASSWORD || 'come_pouco_pass',
    database: process.env.DB_NAME || 'come_pouco_db'
  });

  await client.connect();

  const colRows = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'`
  );

  const existing = new Set(colRows.rows.map((r) => r.column_name));
  const missing = requiredColumns.filter((column) => !existing.has(column));

  if (missing.length) {
    throw new Error(`Missing auth columns in users: ${missing.join(', ')}`);
  }

  const admin = await client.query(
    `SELECT id, username, email, role
       FROM users
      WHERE username = 'admin' OR email = 'admin@comepouco.local'
      ORDER BY id ASC
      LIMIT 1`
  );

  if (!admin.rows.length) {
    throw new Error('Master admin user not found.');
  }

  if (admin.rows[0].role !== 'ADMIN') {
    throw new Error(`Master admin role invalid: ${admin.rows[0].role}`);
  }

  let hasPrismaMigrationTable = false;
  try {
    const table = await client.query(
      `SELECT to_regclass('public._prisma_migrations') AS migrations_table`
    );
    hasPrismaMigrationTable = Boolean(table.rows[0]?.migrations_table);
  } catch {
    hasPrismaMigrationTable = false;
  }

  if (!hasPrismaMigrationTable) {
    console.warn('[WARN] _prisma_migrations table not found. Run baseline procedure before deploy.');
  }

  console.log('AUTH_HARDENING_CHECK_OK');
  await client.end();
})().catch(async (error) => {
  console.error(`AUTH_HARDENING_CHECK_FAIL: ${error.message}`);
  process.exit(1);
});