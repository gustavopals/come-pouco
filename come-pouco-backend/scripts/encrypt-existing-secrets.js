const crypto = require('crypto');
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const ENCRYPTION_PREFIX = 'enc:v1:';
const DEFAULT_TWOFA_KEY = 'dev-twofa-encryption-key-change-me';
const encryptionKey = process.env.TWOFA_ENCRYPTION_KEY || DEFAULT_TWOFA_KEY;
const dryRun = String(process.env.SECRETS_MIGRATION_DRY_RUN || 'false').toLowerCase() === 'true';

const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'come_pouco_user',
      password: process.env.DB_PASSWORD || 'come_pouco_pass',
      database: process.env.DB_NAME || 'come_pouco_db'
    };

const targets = [
  {
    table: 'purchase_platforms',
    idColumn: 'id',
    columns: ['secret', 'access_key']
  },
  {
    table: 'system_email_configs',
    idColumn: 'id',
    columns: [
      'smtp_password',
      'resend_api_key',
      'sendgrid_api_key',
      'ses_secret_key',
      'mailgun_api_key'
    ]
  }
];

const deriveKey = () => crypto.createHash('sha256').update(encryptionKey).digest();

const isEncryptedSecret = (value) =>
  typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);

const encryptSecret = (plainText) => {
  if (!plainText.length || isEncryptedSecret(plainText)) {
    return plainText;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

const quoteIdentifier = (identifier) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
};

const encryptTableSecrets = async (client, target) => {
  const table = quoteIdentifier(target.table);
  const idColumn = quoteIdentifier(target.idColumn);
  const columns = target.columns.map(quoteIdentifier);
  const selectSql = `SELECT ${idColumn}, ${columns.join(', ')} FROM ${table}`;
  const result = await client.query(selectSql);
  let encryptedCount = 0;

  for (const row of result.rows) {
    for (const column of target.columns) {
      const value = row[column];

      if (typeof value !== 'string' || !value.trim().length || isEncryptedSecret(value)) {
        continue;
      }

      encryptedCount += 1;

      if (dryRun) {
        continue;
      }

      await client.query(
        `UPDATE ${table} SET ${quoteIdentifier(column)} = $1 WHERE ${idColumn} = $2`,
        [encryptSecret(value), row[target.idColumn]]
      );
    }
  }

  return encryptedCount;
};

(async () => {
  if (process.env.APP_ENV === 'production' && encryptionKey === DEFAULT_TWOFA_KEY) {
    throw new Error('TWOFA_ENCRYPTION_KEY must be set before encrypting production secrets.');
  }

  const client = new Client(dbConfig);
  await client.connect();

  try {
    await client.query('BEGIN');

    let total = 0;

    for (const target of targets) {
      const encryptedCount = await encryptTableSecrets(client, target);
      total += encryptedCount;
      console.log(
        `${dryRun ? 'DRY_RUN ' : ''}${target.table}: ${encryptedCount} plaintext value(s) to encrypt`
      );
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log(
      `${dryRun ? 'SECRETS_ENCRYPTION_DRY_RUN_OK' : 'SECRETS_ENCRYPTION_MIGRATION_OK'} total=${total}`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(`SECRETS_ENCRYPTION_MIGRATION_FAIL: ${error.message}`);
  process.exit(1);
});
