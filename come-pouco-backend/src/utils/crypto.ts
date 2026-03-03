import crypto from 'crypto';

import env from '../config/env';

const deriveKey = (): Buffer => {
  return crypto.createHash('sha256').update(env.twoFaEncryptionKey).digest();
};

const hashValue = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

const encryptValue = (plainText: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

const decryptValue = (payload: string): string => {
  const [ivPart, tagPart, cipherPart] = payload.split('.');

  if (!ivPart || !tagPart || !cipherPart) {
    throw new Error('Encrypted payload format is invalid.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherPart, 'base64url')), decipher.final()]);
  return decrypted.toString('utf8');
};

const randomToken = (size = 32): string => {
  return crypto.randomBytes(size).toString('base64url');
};

const randomNumericCode = (length = 8): string => {
  const bytes = crypto.randomBytes(length);
  let output = '';

  for (let index = 0; index < length; index += 1) {
    output += String(bytes[index] % 10);
  }

  return output;
};

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const signValue = (value: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
};

const verifySignedValue = (value: string, signature: string, secret: string): boolean => {
  const expected = signValue(value, secret);
  return safeEqual(expected, signature);
};

export { decryptValue, encryptValue, hashValue, randomNumericCode, randomToken, safeEqual, signValue, verifySignedValue };
