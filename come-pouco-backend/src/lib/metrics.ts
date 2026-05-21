import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

import type { CacheStats } from '../utils/cache';

type ShopeeMode = 'MOCK' | 'REAL';
type ConversionStatus = 'SUCCESS' | 'FALLBACK' | 'ERROR' | 'BOT_DETECTED';
type SentryEventSurface = 'backend';
type SentryEventType = 'exception';
type AuthAttemptResult =
  | 'login_success'
  | 'login_2fa_required'
  | 'login_failure'
  | 'login_locked'
  | '2fa_success'
  | '2fa_failure'
  | '2fa_locked'
  | 'forgot_password_requested'
  | 'reset_password_success'
  | 'reset_password_failure';

const registry = new Registry();

collectDefaultMetrics({
  register: registry
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled by the backend.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry]
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

const shopeeApiCallsTotal = new Counter({
  name: 'shopee_api_calls_total',
  help: 'Total Shopee API shortlink attempts.',
  labelNames: ['mode', 'success'] as const,
  registers: [registry]
});

const shopeeApiDurationSeconds = new Histogram({
  name: 'shopee_api_duration_seconds',
  help: 'Shopee API shortlink attempt duration in seconds.',
  labelNames: ['mode', 'success'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry]
});

const conversionsTotal = new Counter({
  name: 'conversions_total',
  help: 'Total public conversions persisted by status.',
  labelNames: ['status'] as const,
  registers: [registry]
});

const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total auth attempts by result.',
  labelNames: ['result'] as const,
  registers: [registry]
});

const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits.',
  labelNames: ['cache'] as const,
  registers: [registry]
});

const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses.',
  labelNames: ['cache'] as const,
  registers: [registry]
});

const cacheSize = new Gauge({
  name: 'cache_size',
  help: 'Current cache size.',
  labelNames: ['cache'] as const,
  registers: [registry]
});

const cacheHitRatio = new Gauge({
  name: 'cache_hit_ratio',
  help: 'Current cache hit ratio based on in-memory counters.',
  labelNames: ['cache'] as const,
  registers: [registry]
});

const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Approximate active authenticated users seen in the last window.',
  labelNames: ['window'] as const,
  registers: [registry]
});

const dbHealthLatencySeconds = new Gauge({
  name: 'db_health_latency_seconds',
  help: 'Latest database readiness check latency in seconds.',
  registers: [registry]
});

const sentryEventsTotal = new Counter({
  name: 'sentry_events_total',
  help: 'Total events captured and forwarded to Sentry by application surface.',
  labelNames: ['surface', 'event_type'] as const,
  registers: [registry]
});

const ACTIVE_USER_WINDOW_MS = 5 * 60 * 1000;
const activeUserLastSeen = new Map<number, number>();
const lastCacheCounters = new Map<string, { hits: number; misses: number }>();

const getRouteTemplate = (req: Request): string => {
  const routePath = req.route?.path;
  const normalizedRoutePath =
    typeof routePath === 'string'
      ? routePath
      : Array.isArray(routePath)
        ? routePath.join('|')
        : undefined;

  if (normalizedRoutePath) {
    return `${req.baseUrl || ''}${normalizedRoutePath}`;
  }

  if (req.baseUrl) {
    return `${req.baseUrl}/*`;
  }

  return 'unmatched';
};

const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = {
      method: req.method,
      route: getRouteTemplate(req),
      status: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);

    if (typeof req.userId === 'number') {
      activeUserLastSeen.set(req.userId, Date.now());
    }
  });

  next();
};

const recordShopeeApiCall = (input: {
  mode: ShopeeMode;
  success: boolean;
  durationMs: number;
}): void => {
  const labels = {
    mode: input.mode,
    success: String(input.success)
  };

  shopeeApiCallsTotal.inc(labels);
  shopeeApiDurationSeconds.observe(labels, input.durationMs / 1000);
};

const recordConversion = (status: ConversionStatus): void => {
  conversionsTotal.inc({ status });
};

const recordAuthAttempt = (result: AuthAttemptResult): void => {
  authAttemptsTotal.inc({ result });
};

const recordCacheHit = (cache: string): void => {
  cacheHitsTotal.inc({ cache });
};

const recordCacheMiss = (cache: string): void => {
  cacheMissesTotal.inc({ cache });
};

const recordDbHealthLatency = (latencyMs: number): void => {
  dbHealthLatencySeconds.set(latencyMs / 1000);
};

const recordSentryEvent = (input: {
  surface: SentryEventSurface;
  eventType: SentryEventType;
}): void => {
  sentryEventsTotal.inc({
    surface: input.surface,
    event_type: input.eventType
  });
};

const updateCacheMetrics = (cache: string, stats: CacheStats): void => {
  const total = stats.hits + stats.misses;
  const previous = lastCacheCounters.get(cache) ?? { hits: 0, misses: 0 };
  const hitDelta = Math.max(0, stats.hits - previous.hits);
  const missDelta = Math.max(0, stats.misses - previous.misses);

  if (hitDelta > 0) {
    cacheHitsTotal.inc({ cache }, hitDelta);
  }

  if (missDelta > 0) {
    cacheMissesTotal.inc({ cache }, missDelta);
  }

  lastCacheCounters.set(cache, {
    hits: stats.hits,
    misses: stats.misses
  });

  cacheSize.set({ cache }, stats.size);
  cacheHitRatio.set({ cache }, total > 0 ? stats.hits / total : 0);
};

const updateActiveUserMetrics = (): void => {
  const cutoff = Date.now() - ACTIVE_USER_WINDOW_MS;

  activeUserLastSeen.forEach((lastSeenAt, userId) => {
    if (lastSeenAt < cutoff) {
      activeUserLastSeen.delete(userId);
    }
  });

  activeUsers.set({ window: '5m' }, activeUserLastSeen.size);
};

const getMetrics = async (): Promise<string> => {
  updateActiveUserMetrics();
  return registry.metrics();
};

const getMetricsContentType = (): string => registry.contentType;

export {
  getMetrics,
  getMetricsContentType,
  metricsMiddleware,
  recordAuthAttempt,
  recordCacheHit,
  recordCacheMiss,
  recordConversion,
  recordDbHealthLatency,
  recordSentryEvent,
  recordShopeeApiCall,
  registry,
  updateCacheMetrics
};
export type {
  AuthAttemptResult,
  ConversionStatus,
  SentryEventSurface,
  SentryEventType,
  ShopeeMode
};
