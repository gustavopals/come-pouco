import type { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const rawCorsOrigins =
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  'http://localhost:4200,http://127.0.0.1:4200';

interface EnvConfig {
  port: number;
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
  corsOrigins: string[];
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

const env: EnvConfig = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'come_pouco_db',
    user: process.env.DB_USER || 'come_pouco_user',
    password: process.env.DB_PASSWORD || 'come_pouco_pass'
  },
  databaseUrl,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn']
  },
  corsOrigins: rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};

export default env;
