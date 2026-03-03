import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const normalizeBase32 = (value: string): string => value.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');

const base32ToBuffer = (base32: string): Buffer => {
  const normalized = normalizeBase32(base32);
  let bits = '';

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index < 0) {
      throw new Error('Invalid base32 character.');
    }

    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let cursor = 0; cursor + 8 <= bits.length; cursor += 8) {
    bytes.push(parseInt(bits.slice(cursor, cursor + 8), 2));
  }

  return Buffer.from(bytes);
};

const generateBase32Secret = (length = 20): string => {
  const bytes = crypto.randomBytes(length);
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let output = '';
  for (let cursor = 0; cursor < bits.length; cursor += 5) {
    const chunk = bits.slice(cursor, cursor + 5);
    if (chunk.length < 5) {
      output += BASE32_ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)];
    } else {
      output += BASE32_ALPHABET[parseInt(chunk, 2)];
    }
  }

  return output;
};

const buildOtpAuthUrl = ({ issuer, label, secret }: { issuer: string; label: string; secret: string }): string => {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(`${issuer}:${label}`);

  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
};

const generateTotp = (secret: string, timeSeconds: number, step = 30, digits = 6): string => {
  const counter = Math.floor(timeSeconds / step);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const key = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binaryCode % 10 ** digits).toString().padStart(digits, '0');
};

const verifyTotp = ({
  secret,
  token,
  window = 1,
  step = 30,
  digits = 6,
  now = Date.now()
}: {
  secret: string;
  token: string;
  window?: number;
  step?: number;
  digits?: number;
  now?: number;
}): boolean => {
  const safeToken = token.trim();

  if (!/^\d{6}$/.test(safeToken)) {
    return false;
  }

  const nowSeconds = Math.floor(now / 1000);

  for (let delta = -window; delta <= window; delta += 1) {
    const candidate = generateTotp(secret, nowSeconds + delta * step, step, digits);
    if (candidate === safeToken) {
      return true;
    }
  }

  return false;
};

export { buildOtpAuthUrl, generateBase32Secret, verifyTotp };