import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const DEFAULT_DATABASE_URL =
  'postgresql://come_pouco_user:come_pouco_pass@localhost:5432/come_pouco_db';
const SCHEMA_NAME_PATTERN = /^test_[a-z0-9_]+$/;

export interface PrismaTestContext {
  schema: string;
  databaseUrl: string;
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
}

export const createTestSchemaName = (): string => `test_${randomUUID().replace(/-/g, '_')}`;

export const getTestDatabaseUrl = (): string =>
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

export const buildDatabaseUrlWithSchema = (databaseUrl: string, schema: string): string => {
  assertSafeSchemaName(schema);

  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
};

export const createPrismaTestClient = (databaseUrl: string): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: [{ emit: 'stdout', level: 'error' }]
  });

export const setupPrismaTestSchema = async (
  schema = createTestSchemaName()
): Promise<PrismaTestContext> => {
  assertSafeSchemaName(schema);

  const databaseUrl = buildDatabaseUrlWithSchema(getTestDatabaseUrl(), schema);
  const migrator = createPrismaTestClient(databaseUrl);

  await migrator.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await migrator.$disconnect();

  await runMigrations(databaseUrl);

  const prisma = createPrismaTestClient(databaseUrl);

  return {
    schema,
    databaseUrl,
    prisma,
    cleanup: async () => {
      await prisma.$disconnect().catch(() => undefined);

      const cleanupClient = createPrismaTestClient(databaseUrl);
      try {
        await cleanupClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await cleanupClient.$disconnect().catch(() => undefined);
      }
    }
  };
};

const runMigrations = async (databaseUrl: string): Promise<void> => {
  const backendRoot = path.resolve(__dirname, '../..');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  await execFileAsync(npx, ['prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
      APP_ENV: 'development',
      PUBLIC_IP_HASH_SALT: process.env.PUBLIC_IP_HASH_SALT || 'test-public-ip-hash-salt'
    }
  });
};

const assertSafeSchemaName = (schema: string): void => {
  if (!SCHEMA_NAME_PATTERN.test(schema)) {
    throw new Error(`Unsafe test schema name: ${schema}`);
  }
};
