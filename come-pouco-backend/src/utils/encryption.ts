import crypto from 'crypto';

import env from '../config/env';

const ENCRYPTION_PREFIX = 'enc:v1:';
const SECRET_MASK_PREFIX = '\u2022\u2022\u2022\u2022';

const deriveKey = (): Buffer => {
  return crypto.createHash('sha256').update(env.twoFaEncryptionKey).digest();
};

const isEncryptedSecret = (value: string | null | undefined): value is string => {
  return typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
};

const encryptSecret = (plainText: string): string => {
  if (!plainText.length || isEncryptedSecret(plainText)) {
    return plainText;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

const decryptSecret = (cipherText: string): string => {
  if (!cipherText.length || !isEncryptedSecret(cipherText)) {
    return cipherText;
  }

  const payload = cipherText.slice(ENCRYPTION_PREFIX.length);
  const [ivPart, tagPart, cipherPart] = payload.split('.');

  if (!ivPart || !tagPart || !cipherPart) {
    throw new Error('Encrypted secret format is invalid.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherPart, 'base64url')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
};

const decryptNullableSecret = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null || !value.length) {
    return null;
  }

  return decryptSecret(value);
};

const maskSecret = (value: string | null | undefined): string | null => {
  const plainText = decryptNullableSecret(value);

  if (!plainText || !plainText.trim().length) {
    return null;
  }

  return `${SECRET_MASK_PREFIX}${plainText.trim().slice(-4)}`;
};

const isMaskedSecretValue = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  return (
    normalized.startsWith(SECRET_MASK_PREFIX) ||
    normalized.startsWith('****') ||
    normalized === '********'
  );
};

export {
  ENCRYPTION_PREFIX,
  decryptNullableSecret,
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  isMaskedSecretValue,
  maskSecret
};
