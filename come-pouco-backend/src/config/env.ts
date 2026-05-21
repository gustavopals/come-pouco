import type { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const rawCorsOrigins =
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  'http://localhost:4200,http://127.0.0.1:4200';
const rawPublicCorsOrigins = process.env.PUBLIC_CORS_ORIGINS || rawCorsOrigins;

interface EnvConfig {
  port: number;
  appEnv: 'development' | 'production';
  appVersion: string;
  logLevel: string;
  logFormat: 'json' | 'pretty';
  sentry: {
    backendDsn: string | null;
    environment: string;
    release: string | null;
    tracesSampleRate: number;
  };
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
  apiRequestLogRetentionDays: number;
  auditLogRetentionDays: number;
  conversionRetentionDays: number;
  twoFaEncryptionKey: string;
  publicAppUrl: string;
  publicCacheMaxEntries: number;
  publicCacheDefaultTtlSec: number;
  publicCorsOrigins: string[];
  publicIpHashSalt: string;
  shortlinkMockTargetUrl: string | null;
  shortlinkTimeoutMs: number;
  health: {
    databaseLatencyWarnMs: number;
    shopeeEnabled: boolean;
    shopeeUrl: string;
    shopeeTimeoutMs: number;
  };
  metrics: {
    user: string;
    password: string;
    configured: boolean;
  };
  corsOrigins: string[];
  shopeeMock: boolean;
  shopeeMockFailurePattern: string | null;
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

const appEnv: 'development' | 'production' =
  (process.env.APP_ENV || 'development') === 'production' ? 'production' : 'development';
const normalizeOptionalString = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized?.length ? normalized : null;
};
const appVersion =
  normalizeOptionalString(process.env.APP_VERSION) ||
  normalizeOptionalString(process.env.SENTRY_RELEASE) ||
  normalizeOptionalString(process.env.COMMIT_SHA) ||
  normalizeOptionalString(process.env.GIT_SHA) ||
  '1.0.0';
const logLevels = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);
const rawLogLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
const rawLogFormat = process.env.LOG_FORMAT?.trim().toLowerCase();
const logLevel =
  rawLogLevel && logLevels.has(rawLogLevel)
    ? rawLogLevel
    : appEnv === 'production'
      ? 'info'
      : 'debug';
const logFormat: 'json' | 'pretty' =
  rawLogFormat === 'json' || rawLogFormat === 'pretty'
    ? rawLogFormat
    : appEnv === 'production'
      ? 'json'
      : 'pretty';
const normalizeSampleRate = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
};
const sentryEnvironment = normalizeOptionalString(process.env.SENTRY_ENVIRONMENT) || appEnv;
const sentryRelease =
  normalizeOptionalString(process.env.SENTRY_RELEASE) ||
  normalizeOptionalString(process.env.COMMIT_SHA) ||
  normalizeOptionalString(process.env.GIT_SHA);
const sentryBackendDsn =
  normalizeOptionalString(process.env.SENTRY_DSN_BACKEND) ||
  normalizeOptionalString(process.env.SENTRY_DSN);
const sentryTracesSampleRate = normalizeSampleRate(
  process.env.SENTRY_TRACES_SAMPLE_RATE_BACKEND || process.env.SENTRY_TRACES_SAMPLE_RATE,
  appEnv === 'production' ? 0.1 : 1
);
const metricsUser =
  normalizeOptionalString(process.env.METRICS_USER) || (appEnv === 'production' ? '' : 'metrics');
const metricsPassword =
  normalizeOptionalString(process.env.METRICS_PASSWORD) ||
  (appEnv === 'production' ? '' : 'metrics-dev-change-me');

const jwtSecret =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
    ? process.env.JWT_SECRET
    : 'dev-secret-change-me';
const twoFaEncryptionKey =
  process.env.TWOFA_ENCRYPTION_KEY && process.env.TWOFA_ENCRYPTION_KEY.trim().length > 0
    ? process.env.TWOFA_ENCRYPTION_KEY
    : 'dev-twofa-encryption-key-change-me';
const publicAppUrl = process.env.PUBLIC_APP_URL?.trim() || 'http://localhost:4200';
const publicIpHashSalt =
  process.env.PUBLIC_IP_HASH_SALT?.trim() || 'dev-public-ip-hash-salt-change-me';

if (appEnv === 'production') {
  if (jwtSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET ausente em producao.');
  }

  if (twoFaEncryptionKey === 'dev-twofa-encryption-key-change-me') {
    throw new Error('TWOFA_ENCRYPTION_KEY ausente em producao.');
  }

  if (publicIpHashSalt === 'dev-public-ip-hash-salt-change-me') {
    throw new Error('PUBLIC_IP_HASH_SALT ausente em producao.');
  }
}

const env: EnvConfig = {
  port: Number(process.env.PORT) || 3000,
  appEnv,
  appVersion,
  logLevel,
  logFormat,
  sentry: {
    backendDsn: sentryBackendDsn,
    environment: sentryEnvironment,
    release: sentryRelease,
    tracesSampleRate: sentryTracesSampleRate
  },
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
  apiRequestLogRetentionDays: Math.max(
    1,
    Number(process.env.API_REQUEST_LOG_RETENTION_DAYS || 90) || 90
  ),
  auditLogRetentionDays: Math.max(1, Number(process.env.AUDIT_LOG_RETENTION_DAYS || 365) || 365),
  conversionRetentionDays: Math.max(1, Number(process.env.CONVERSION_RETENTION_DAYS || 180) || 180),
  twoFaEncryptionKey,
  publicAppUrl,
  publicCacheMaxEntries: Math.max(
    1,
    Number(process.env.PUBLIC_CACHE_MAX_ENTRIES || 10_000) || 10_000
  ),
  publicCacheDefaultTtlSec: Math.max(
    1,
    Number(process.env.PUBLIC_CACHE_DEFAULT_TTL_SEC || 1800) || 1800
  ),
  publicCorsOrigins: rawPublicCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicIpHashSalt,
  shortlinkMockTargetUrl: normalizeOptionalString(process.env.SHORTLINK_MOCK_TARGET_URL),
  shortlinkTimeoutMs: Math.max(100, Number(process.env.SHORTLINK_TIMEOUT_MS || 5000) || 5000),
  health: {
    databaseLatencyWarnMs: Math.max(1, Number(process.env.HEALTH_DB_LATENCY_WARN_MS || 100) || 100),
    shopeeEnabled: String(process.env.HEALTH_SHOPEE_ENABLED || 'false').toLowerCase() === 'true',
    shopeeUrl:
      normalizeOptionalString(process.env.HEALTH_SHOPEE_URL) ||
      'https://open-api.affiliate.shopee.com.br/graphql',
    shopeeTimeoutMs: Math.max(100, Number(process.env.HEALTH_SHOPEE_TIMEOUT_MS || 3000) || 3000)
  },
  metrics: {
    user: metricsUser,
    password: metricsPassword,
    configured: Boolean(metricsUser && metricsPassword)
  },
  corsOrigins: rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  shopeeMock: String(process.env.SHOPEE_MOCK || 'false').toLowerCase() === 'true',
  shopeeMockFailurePattern: normalizeOptionalString(process.env.SHOPEE_MOCK_FAILURE_PATTERN)
};

export default env;
