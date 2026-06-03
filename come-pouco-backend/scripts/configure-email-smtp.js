/**
 * Grava configuracao SMTP Hostinger (ou outro) em system_email_configs.
 *
 * Uso:
 *   SMTP_PASSWORD='sua-senha' node scripts/configure-email-smtp.js
 */
const crypto = require('crypto');
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const ENCRYPTION_PREFIX = 'enc:v1:';
const encryptionKey = process.env.TWOFA_ENCRYPTION_KEY || 'dev-twofa-encryption-key-change-me';

const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'come_pouco_user',
      password: process.env.DB_PASSWORD || 'come_pouco_pass',
      database: process.env.DB_NAME || 'come_pouco_db'
    };

const deriveKey = () => crypto.createHash('sha256').update(encryptionKey).digest();

const encryptSecret = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

const smtpPassword = process.env.SMTP_PASSWORD?.trim();
if (!smtpPassword) {
  console.error('Defina SMTP_PASSWORD no ambiente (nao coloque no .env versionado).');
  process.exit(1);
}

const fromEmail = (process.env.FROM_EMAIL || 'contato@auralinks.com.br').trim().toLowerCase();
const fromName = (process.env.FROM_NAME || 'AuraLinks').trim();
const smtpHost = (process.env.SMTP_HOST || 'smtp.hostinger.com').trim();
const smtpPort = Number(process.env.SMTP_PORT || '587');
const smtpUser = (process.env.SMTP_USER || 'contato@auralinks.com.br').trim();
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const encryptedPassword = encryptSecret(smtpPassword);

const upsertSql = `
INSERT INTO system_email_configs (
  id, provider, from_email, from_name, enabled,
  smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure,
  updated_at
) VALUES (
  1, 'smtp', $1, $2, true,
  $3, $4, $5, $6, $7,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  from_email = EXCLUDED.from_email,
  from_name = EXCLUDED.from_name,
  enabled = EXCLUDED.enabled,
  smtp_host = EXCLUDED.smtp_host,
  smtp_port = EXCLUDED.smtp_port,
  smtp_user = EXCLUDED.smtp_user,
  smtp_password = EXCLUDED.smtp_password,
  smtp_secure = EXCLUDED.smtp_secure,
  updated_at = NOW();
`;

async function main() {
  const client = new Client(dbConfig);
  await client.connect();
  await client.query(upsertSql, [
    fromEmail,
    fromName,
    smtpHost,
    smtpPort,
    smtpUser,
    encryptedPassword,
    smtpSecure
  ]);
  await client.end();

  console.log('OK: e-mail SMTP configurado e habilitado.');
  console.log(`  Remetente: ${fromName} <${fromEmail}>`);
  console.log(`  Servidor: ${smtpHost}:${smtpPort} (secure=${smtpSecure})`);
}

main().catch((error) => {
  console.error('Falha ao configurar SMTP:', error.message);
  process.exit(1);
});
