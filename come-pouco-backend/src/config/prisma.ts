import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import env from './env';
import { logger } from '../lib/logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const adapter = new PrismaPg({ connectionString: env.databaseUrl });
const SLOW_QUERY_THRESHOLD_MS = 500;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      env.appEnv === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' }
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' }
          ]
  });

const prismaLogger = logger.child({ scope: 'prisma' });

type PrismaQueryEvent = { duration: number; query: string };
type PrismaLogEvent = { message: string; target?: string; timestamp?: Date };
type PrismaEventClient = {
  $on(eventName: 'query', callback: (event: PrismaQueryEvent) => void): void;
  $on(eventName: 'warn' | 'error', callback: (event: PrismaLogEvent) => void): void;
};

const prismaEvents = prisma as unknown as PrismaEventClient;

if (env.appEnv === 'development') {
  prismaEvents.$on('query', (event) => {
    if (event.duration >= SLOW_QUERY_THRESHOLD_MS) {
      prismaLogger.warn(
        {
          eventType: 'prisma_slow_query',
          durationMs: event.duration,
          query: event.query
        },
        'slow prisma query'
      );
    }
  });
}

prismaEvents.$on('warn', (event) => {
  prismaLogger.warn(
    {
      eventType: 'prisma_warning',
      target: event.target,
      timestamp: event.timestamp?.toISOString()
    },
    event.message
  );
});

prismaEvents.$on('error', (event) => {
  prismaLogger.error(
    {
      eventType: 'prisma_error',
      target: event.target,
      timestamp: event.timestamp?.toISOString()
    },
    event.message
  );
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
