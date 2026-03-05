import type { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const rawCorsOrigins =
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  'http://localhost:4200,http://127.0.0.1:4200';

interface EnvConfig {
  port: number;
  appEnv: 'development' | 'production';
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: SignOptions['expiresIn'];
  };
  trustedDeviceDays: number;
  twoFaEncryptionKey: string;
  publicAppUrl: string;
  corsOrigins: string[];
  shopeeMock: boolean;
}

const buildDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 5432;
  const database = process.env.DB_NAME || 'come_pouco_db';
  const user = process.env.DB_USER || 'come_pouco_user';
  const password = process.env.DB_PASSWORD || 'come_pouco_pass';

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
};

const databaseUrl = buildDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

const appEnv: 'development' | 'production' = (process.env.APP_ENV || 'development') === 'production' ? 'production' : 'development';

const jwtSecret = process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0 ? process.env.JWT_SECRET : 'dev-secret-change-me';
const twoFaEncryptionKey =
  process.env.TWOFA_ENCRYPTION_KEY && process.env.TWOFA_ENCRYPTION_KEY.trim().length > 0
    ? process.env.TWOFA_ENCRYPTION_KEY
    : 'dev-twofa-encryption-key-change-me';
const publicAppUrl = process.env.PUBLIC_APP_URL?.trim() || 'http://localhost:4200';

if (appEnv === 'production') {
  if (jwtSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET ausente em producao.');
  }

  if (twoFaEncryptionKey === 'dev-twofa-encryption-key-change-me') {
    throw new Error('TWOFA_ENCRYPTION_KEY ausente em producao.');
  }
}

const env: EnvConfig = {
  port: Number(process.env.PORT) || 3000,
  appEnv,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'come_pouco_db',
    user: process.env.DB_USER || 'come_pouco_user',
    password: process.env.DB_PASSWORD || 'come_pouco_pass'
  },
  databaseUrl,
  jwt: {
    secret: jwtSecret,
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn']
  },
  trustedDeviceDays: Math.max(1, Number(process.env.TRUSTED_DEVICE_DAYS || 30) || 30),
  twoFaEncryptionKey,
  publicAppUrl,
  corsOrigins: rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  shopeeMock: String(process.env.SHOPEE_MOCK || 'false').toLowerCase() === 'true'
};

export default env;
