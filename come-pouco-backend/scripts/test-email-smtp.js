/**
 * Envia e-mail de teste usando system_email_configs (id=1).
 * Uso: TEST_TO=contato@auralinks.com.br node scripts/test-email-smtp.js
 */
const crypto = require('crypto');
require('dotenv').config({ quiet: true });
const nodemailer = require('nodemailer');
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

const decryptSecret = (cipherText) => {
  if (!cipherText || !cipherText.startsWith(ENCRYPTION_PREFIX)) {
    return cipherText;
  }

  const payload = cipherText.slice(ENCRYPTION_PREFIX.length);
  const [ivPart, tagPart, cipherPart] = payload.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherPart, 'base64url')),
    decipher.final()
  ]).toString('utf8');
};

async function main() {
  const client = new Client(dbConfig);
  await client.connect();
  const { rows } = await client.query(
    `SELECT provider, enabled, from_email, from_name, smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure
     FROM system_email_configs WHERE id = 1`
  );
  await client.end();

  const config = rows[0];
  if (!config?.enabled) {
    throw new Error('Configuracao de e-mail ausente ou desabilitada.');
  }

  const pass = decryptSecret(config.smtp_password);
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: Boolean(config.smtp_secure),
    auth: { user: config.smtp_user, pass }
  });

  const to = (process.env.TEST_TO || config.from_email).trim();
  const fromName = config.from_name || 'AuraLinks';
  const from = `"${fromName}" <${config.from_email}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Teste SMTP AuraLinks',
    text: 'Se voce recebeu este e-mail, o SMTP Hostinger esta funcionando no backend.',
    html: '<p>Se voce recebeu este e-mail, o SMTP Hostinger esta funcionando no backend.</p>'
  });

  console.log('OK: e-mail de teste enviado.');
  console.log(`  Para: ${to}`);
  console.log(`  MessageId: ${info.messageId || '(n/a)'}`);
}

main().catch((error) => {
  console.error('Falha no envio de teste:', error.message);
  process.exit(1);
});
