import crypto from 'node:crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';
const TWOFA_ENCRYPTION_KEY =
  process.env.TWOFA_ENCRYPTION_KEY || 'dev-twofa-encryption-key-change-me';

const deriveKey = (): Buffer => crypto.createHash('sha256').update(TWOFA_ENCRYPTION_KEY).digest();

const encryptValue = (plainText: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

const encryptSecret = (plainText: string): string => {
  if (!plainText.length || plainText.startsWith(ENCRYPTION_PREFIX)) {
    return plainText;
  }

  return `${ENCRYPTION_PREFIX}${encryptValue(plainText)}`;
};

export { encryptSecret, encryptValue };
