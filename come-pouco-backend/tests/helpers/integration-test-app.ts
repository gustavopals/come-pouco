import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';

import {
  createPrismaTestClient,
  getTestDatabaseUrl,
  setupPrismaTestSchema,
  type PrismaTestContext
} from './prisma-test';

export interface IntegrationTestAppContext {
  app: Express;
  prisma: PrismaClient;
  database: PrismaTestContext;
  cleanup: () => Promise<void>;
}

const TEST_ENV = {
  APP_ENV: 'development',
  NODE_ENV: 'test',
  JWT_SECRET: 'integration-jwt-secret-change-me',
  JWT_EXPIRES_IN: '1h',
  TWOFA_ENCRYPTION_KEY: 'integration-twofa-encryption-key-change-me',
  PUBLIC_IP_HASH_SALT: 'integration-public-ip-hash-salt-change-me',
  SHOPEE_MOCK: 'true',
  LOG_LEVEL: 'silent',
  SENTRY_BACKEND_DSN: ''
};

export const shouldRunIntegrationTests = (): boolean =>
  process.env.RUN_INTEGRATION_TESTS === 'true';

export const canReachIntegrationDatabase = async (): Promise<boolean> => {
  const prisma = createPrismaTestClient(getTestDatabaseUrl());

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
};

export const createIntegrationTestApp = async (): Promise<IntegrationTestAppContext> => {
  const previousEnv = snapshotEnv();

  Object.assign(process.env, TEST_ENV);

  const database = await setupPrismaTestSchema();
  process.env.DATABASE_URL = database.databaseUrl;
  delete (globalThis as { prisma?: PrismaClient }).prisma;
  vi.resetModules();

  const [{ default: app }, { default: prisma }] = await Promise.all([
    import('../../src/app'),
    import('../../src/config/prisma')
  ]);

  return {
    app,
    prisma,
    database,
    cleanup: async () => {
      await prisma.$disconnect().catch(() => undefined);
      delete (globalThis as { prisma?: PrismaClient }).prisma;
      await database.cleanup();
      restoreEnv(previousEnv);
    }
  };
};

const snapshotEnv = (): Record<keyof typeof TEST_ENV | 'DATABASE_URL', string | undefined> => ({
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  TWOFA_ENCRYPTION_KEY: process.env.TWOFA_ENCRYPTION_KEY,
  PUBLIC_IP_HASH_SALT: process.env.PUBLIC_IP_HASH_SALT,
  SHOPEE_MOCK: process.env.SHOPEE_MOCK,
  LOG_LEVEL: process.env.LOG_LEVEL,
  SENTRY_BACKEND_DSN: process.env.SENTRY_BACKEND_DSN,
  DATABASE_URL: process.env.DATABASE_URL
});

const restoreEnv = (previousEnv: ReturnType<typeof snapshotEnv>): void => {
  Object.entries(previousEnv).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  });
};
