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
  jwt: {
    secret: string;
    expiresIn: SignOptions['expiresIn'];
  };
  corsOrigins: string[];
}

const env: EnvConfig = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'come_pouco_db',
    user: process.env.DB_USER || 'come_pouco_user',
    password: process.env.DB_PASSWORD || 'come_pouco_pass'
  },
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
