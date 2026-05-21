import path from 'node:path';
import { createRequire } from 'node:module';

import { e2eConfig } from './config';

const requireFromBackend = createRequire(
  path.join(process.cwd(), 'come-pouco-backend', 'package.json')
);
const { PrismaClient } = requireFromBackend('@prisma/client') as {
  PrismaClient: new (options: unknown) => E2EPrismaClient;
};
const { PrismaPg } = requireFromBackend('@prisma/adapter-pg') as {
  PrismaPg: new (options: { connectionString: string }) => unknown;
};

type E2EPrismaClient = {
  $disconnect(): Promise<void>;
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  affiliateLink: { deleteMany(args: unknown): Promise<unknown> };
  apiRequestLog: { deleteMany(args: unknown): Promise<unknown> };
  auditLog: { deleteMany(args: unknown): Promise<unknown> };
  company: {
    create(args: unknown): Promise<{ id: number; name: string; publicSlug: string | null }>;
    deleteMany(args: unknown): Promise<unknown>;
  };
  companyPlatform: {
    create(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<unknown>;
  };
  conversion: {
    count(args: unknown): Promise<number>;
    deleteMany(args: unknown): Promise<unknown>;
    findFirst(
      args: unknown
    ): Promise<{ id: string; employeeId: number | null; status: string } | null>;
  };
  landingConfig: { deleteMany(args: unknown): Promise<unknown> };
  passwordResetToken: { deleteMany(args: unknown): Promise<unknown> };
  purchasePlatform: {
    create(args: unknown): Promise<{ id: number }>;
    deleteMany(args: unknown): Promise<unknown>;
  };
  systemEmailConfig: {
    upsert(args: unknown): Promise<unknown>;
  };
  trustedDevice: { deleteMany(args: unknown): Promise<unknown> };
  twoFactorBackupCode: { deleteMany(args: unknown): Promise<unknown> };
  user: {
    create(args: unknown): Promise<{ id: number; username: string; email: string | null }>;
    deleteMany(args: unknown): Promise<unknown>;
  };
};

let prisma: E2EPrismaClient | null = null;

const getPrisma = (): E2EPrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: e2eConfig.databaseURL })
    });
  }

  return prisma;
};

const disconnectPrisma = async (): Promise<void> => {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = null;
};

export { disconnectPrisma, getPrisma };
export type { E2EPrismaClient };
