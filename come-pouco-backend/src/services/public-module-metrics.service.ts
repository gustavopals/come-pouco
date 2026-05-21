import type { ConversionStatus } from '@prisma/client';

import { publicCache } from '../cache/public.cache';
import prisma from '../config/prisma';

interface PublicModuleMetrics {
  generatedAt: string;
  cache: {
    hits: number;
    misses: number;
    size: number;
    hitRatio: number;
  };
  conversions: {
    windowMinutes: number;
    lastHourTotal: number;
    perMinute: number;
    last24h: {
      total: number;
      success: number;
      fallback: number;
      error: number;
      botDetected: number;
      fallbackRatio: number;
    };
  };
}

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const STATUS_KEYS: ConversionStatus[] = ['SUCCESS', 'FALLBACK', 'ERROR', 'BOT_DETECTED'];

const toRate = (value: number, total: number): number =>
  total > 0 ? Number((value / total).toFixed(4)) : 0;

const getPublicModuleMetrics = async (): Promise<PublicModuleMetrics> => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - ONE_HOUR_MS);
  const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
  const cacheStats = publicCache.stats();
  const cacheRequests = cacheStats.hits + cacheStats.misses;

  const [lastHourTotal, statusRows] = await Promise.all([
    prisma.conversion.count({
      where: {
        createdAt: {
          gte: oneHourAgo
        }
      }
    }),
    prisma.conversion.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: oneDayAgo
        }
      },
      _count: {
        _all: true
      }
    })
  ]);

  const counts = new Map<ConversionStatus, number>(STATUS_KEYS.map((status) => [status, 0]));
  statusRows.forEach((row) => {
    counts.set(row.status, row._count._all);
  });

  const success = counts.get('SUCCESS') ?? 0;
  const fallback = counts.get('FALLBACK') ?? 0;
  const error = counts.get('ERROR') ?? 0;
  const botDetected = counts.get('BOT_DETECTED') ?? 0;
  const last24hTotal = success + fallback + error + botDetected;

  return {
    generatedAt: now.toISOString(),
    cache: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      size: cacheStats.size,
      hitRatio: toRate(cacheStats.hits, cacheRequests)
    },
    conversions: {
      windowMinutes: 60,
      lastHourTotal,
      perMinute: Number((lastHourTotal / 60).toFixed(4)),
      last24h: {
        total: last24hTotal,
        success,
        fallback,
        error,
        botDetected,
        fallbackRatio: toRate(fallback, last24hTotal)
      }
    }
  };
};

export { getPublicModuleMetrics };
export type { PublicModuleMetrics };
