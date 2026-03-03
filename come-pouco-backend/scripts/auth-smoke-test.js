const crypto = require('crypto');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const PORT = process.env.AUTH_SMOKE_PORT || '3011';
const BASE_URL = process.env.AUTH_SMOKE_BASE_URL || `http://localhost:${PORT}/api`;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'come_pouco_user',
  password: process.env.DB_PASSWORD || 'come_pouco_pass',
  database: process.env.DB_NAME || 'come_pouco_db'
};

const deriveKey = () => crypto.createHash('sha256').update(process.env.TWOFA_ENCRYPTION_KEY || 'dev-twofa-encryption-key-change-me').digest();

const encryptSecret = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

const base32ToBuffer = (base32) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = base32.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = '';

  for (const c of normalized) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw new Error('Invalid base32 secret');
    bits += i.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let p = 0; p + 8 <= bits.length; p += 8) {
    bytes.push(parseInt(bits.slice(p, p + 8), 2));
  }

  return Buffer.from(bytes);
};

const generateTotp = (secret, nowMs = Date.now()) => {
  const step = 30;
  const digits = 6;
  const counter = Math.floor(Math.floor(nowMs / 1000) / step);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const key = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
};

const request = async (path, body, token) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: response.status, data };
};

(async () => {
  const db = new Client(dbConfig);
  await db.connect();

  const username = 'smoke2fauser';
  const email = 'smoke2fa@local';
  const password = 'SmokePass123!';
  const hash = await bcrypt.hash(password, 10);
  const secret = 'JBSWY3DPEHPK3PXP';

  await db.query(`
    INSERT INTO users (full_name, username, email, password_hash, role, two_factor_enabled, two_factor_secret)
    VALUES ('Smoke 2FA User', $1, $2, $3, 'USER', false, null)
    ON CONFLICT (username)
    DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = 'USER', two_factor_enabled = false, two_factor_secret = null
  `, [username, email, hash]);

  const useExternalServer = String(process.env.AUTH_SMOKE_USE_EXTERNAL || 'false').toLowerCase() === 'true';

  const checks = [];

  let res = await request('/auth/login', { identifier: username, password }, null);
  checks.push(['login_without_2fa', res.status === 200 && !!res.data.token]);

  res = await request('/auth/login', { identifier: username, password: 'wrong-pass' }, null);
  checks.push(['wrong_password', res.status === 401 && res.data.errorCode === 'AUTH_INVALID_CREDENTIALS']);

  await db.query(`UPDATE users SET two_factor_enabled = true, two_factor_secret = $1 WHERE username = $2`, [encryptSecret(secret), username]);

  res = await request('/auth/login', { identifier: username, password }, null);
  const challenge = res.data.tempToken || res.data.challengeId;
  checks.push(['login_with_2fa_challenge', res.status === 200 && !!challenge && !res.data.token]);

  const wrongVerify = await request('/auth/login/2fa', { tempToken: challenge, code: '000000' }, null);
  checks.push(['verify_wrong_code', wrongVerify.status === 400 && wrongVerify.data.errorCode === 'AUTH_INVALID_2FA_CODE']);

  const rightCode = generateTotp(secret);
  const verify = await request('/auth/login/2fa', { tempToken: challenge, code: rightCode }, null);
  checks.push(['verify_right_code', verify.status === 200 && !!verify.data.token]);

  const disableInvalid = await request('/auth/2fa/disable', { password, code: '000000' }, verify.data.token);
  checks.push(['disable_invalid_code', disableInvalid.status === 400 && disableInvalid.data.errorCode === 'AUTH_INVALID_2FA_CODE']);

  if (!useExternalServer) {
    throw new Error('AUTH_SMOKE_USE_EXTERNAL=true is required in this environment (process spawn is restricted).');
  }

  await db.query(`UPDATE users SET two_factor_enabled = false, two_factor_secret = null WHERE username = $1`, [username]);
  await db.end();

  const failed = checks.filter((item) => !item[1]);
  checks.forEach(([name, ok]) => console.log(`${ok ? 'OK' : 'FAIL'} ${name}`));

  if (failed.length) {
    process.exit(1);
  }
})();
