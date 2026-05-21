import type { NextFunction, Request, Response } from 'express';
import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  RateLimitInfo,
  RateLimitRequestHandler,
  Store
} from 'express-rate-limit';
import ipaddr from 'ipaddr.js';

import { AUDIT_EVENTS } from '../constants/audit-events';
import { logger } from '../lib/logger';
import { logEvent } from '../services/audit.service';
import { hashIp } from '../utils/ip-hash';
import { buildRateLimiter } from './rate-limit.middleware';

const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_USER_AGENT_LENGTH = 256;
const MAX_REFERRER_LENGTH = 2048;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;
const publicRateLimitLogger = logger.child({ scope: 'public-rate-limit' });

type PublicRateLimitScope =
  | 'public_convert_minute'
  | 'public_convert_day'
  | 'public_landing_minute';
type RateLimitedRequest = Request & { rateLimit?: RateLimitInfo };

interface PublicRateLimiterOptions {
  scope: PublicRateLimitScope;
  windowMs: number;
  limit: number;
  message: string;
  errorCode: string;
  store?: Options['store'];
}

class SlidingWindowMemoryStore implements Store {
  localKeys = true;

  private windowMs = ONE_MINUTE_MS;
  private lastSweepAt = 0;
  private readonly hitsByKey = new Map<string, number[]>();

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const hits = this.pruneKey(key, Date.now());

    if (!hits.length) {
      return undefined;
    }

    return this.toRateLimitInfo(hits);
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    this.sweepExpiredKeys(now);

    const hits = this.pruneKey(key, now);
    hits.push(now);
    this.hitsByKey.set(key, hits);

    return this.toRateLimitInfo(hits);
  }

  async decrement(key: string): Promise<void> {
    const hits = this.pruneKey(key, Date.now());
    hits.pop();

    if (hits.length) {
      this.hitsByKey.set(key, hits);
      return;
    }

    this.hitsByKey.delete(key);
  }

  async resetKey(key: string): Promise<void> {
    this.hitsByKey.delete(key);
  }

  async resetAll(): Promise<void> {
    this.hitsByKey.clear();
  }

  async shutdown(): Promise<void> {
    this.hitsByKey.clear();
  }

  private pruneKey(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const hits = (this.hitsByKey.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (hits.length) {
      this.hitsByKey.set(key, hits);
      return hits;
    }

    this.hitsByKey.delete(key);
    return hits;
  }

  private sweepExpiredKeys(now: number): void {
    if (now - this.lastSweepAt < Math.min(this.windowMs, ONE_MINUTE_MS)) {
      return;
    }

    this.lastSweepAt = now;
    for (const key of this.hitsByKey.keys()) {
      this.pruneKey(key, now);
    }
  }

  private toRateLimitInfo(hits: number[]): ClientRateLimitInfo {
    return {
      totalHits: hits.length,
      resetTime: new Date(hits[0] + this.windowMs)
    };
  }
}

const normalizePublicRateLimitIp = (rawIp: string | undefined | null): string => {
  const candidate = normalizeIpCandidate(rawIp);

  if (!candidate) {
    return 'unknown';
  }

  try {
    const parsed = ipaddr.process(candidate);

    if (parsed.kind() === 'ipv4') {
      return parsed.toString();
    }

    const parts = [...(parsed as { parts: number[] }).parts];
    for (let index = 4; index < parts.length; index += 1) {
      parts[index] = 0;
    }

    return new ipaddr.IPv6(parts).toNormalizedString();
  } catch {
    return candidate.toLowerCase().slice(0, 128);
  }
};

const sanitizePublicUserAgent = (value: string | undefined | null): string =>
  sanitizePublicHeaderValue(value, MAX_USER_AGENT_LENGTH) || 'unknown';

const sanitizePublicReferrer = (value: string | undefined | null): string | undefined =>
  sanitizePublicHeaderValue(value, MAX_REFERRER_LENGTH) || undefined;

const getPublicClientIp = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';

const getPublicRateLimitKey = (req: Request): string => {
  const normalizedIp = req.publicRateLimitIp ?? normalizePublicRateLimitIp(getPublicClientIp(req));
  return hashIp(normalizedIp);
};

const publicSecurityMetadataMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const normalizedIp = normalizePublicRateLimitIp(getPublicClientIp(req));

  req.publicRateLimitIp = normalizedIp;
  req.publicIpHash = hashIp(normalizedIp);
  req.publicUserAgent = sanitizePublicUserAgent(req.get('user-agent'));
  req.publicReferrer = sanitizePublicReferrer(req.get('referer') || req.get('referrer'));

  next();
};

const publicLandingRateLimiter = buildPublicRateLimiter({
  scope: 'public_landing_minute',
  windowMs: ONE_MINUTE_MS,
  limit: 60,
  message: 'Muitas consultas de landing em pouco tempo. Tente novamente em instantes.',
  errorCode: 'RATE_LIMIT_PUBLIC_LANDING'
});

const publicConvertDailyRateLimiter = buildPublicRateLimiter({
  scope: 'public_convert_day',
  windowMs: ONE_DAY_MS,
  limit: 200,
  store: new SlidingWindowMemoryStore(),
  message: 'Limite diario de conversoes atingido para este IP. Tente novamente mais tarde.',
  errorCode: 'RATE_LIMIT_PUBLIC_CONVERT_DAILY'
});

const publicConvertMinuteRateLimiter = buildPublicRateLimiter({
  scope: 'public_convert_minute',
  windowMs: ONE_MINUTE_MS,
  limit: 30,
  message: 'Muitas conversoes em pouco tempo. Tente novamente em instantes.',
  errorCode: 'RATE_LIMIT_PUBLIC_CONVERT_MINUTE'
});

function buildPublicRateLimiter({
  scope,
  windowMs,
  limit,
  message,
  errorCode,
  store
}: PublicRateLimiterOptions): RateLimitRequestHandler {
  return buildRateLimiter({
    windowMs,
    limit,
    store,
    message,
    errorCode,
    legacyHeaders: true,
    standardHeaders: false,
    keyGenerator: (req) => `${scope}:${getPublicRateLimitKey(req)}`,
    handler: (req, res) => {
      logPublicRateLimitHit(req, scope, limit, windowMs, errorCode);
      res.status(429).json({
        message,
        errorCode
      });
    }
  });
}

function logPublicRateLimitHit(
  req: Request,
  scope: PublicRateLimitScope,
  limit: number,
  windowMs: number,
  errorCode: string
): void {
  const rateInfo = (req as RateLimitedRequest).rateLimit;
  const ipHash = req.publicIpHash ?? getPublicRateLimitKey(req);
  const userAgent = req.publicUserAgent ?? sanitizePublicUserAgent(req.get('user-agent'));
  const resetAt = rateInfo?.resetTime?.toISOString() ?? null;
  const metadata = {
    requestId: req.id ?? null,
    scope,
    method: req.method,
    path: req.originalUrl || req.path,
    limit,
    windowMs,
    used: rateInfo?.used ?? null,
    remaining: rateInfo?.remaining ?? null,
    resetAt,
    errorCode
  };

  logEvent({
    eventType: AUDIT_EVENTS.PUBLIC_RATE_LIMIT_HIT,
    entityType: 'public_endpoint',
    entityId: scope,
    ip: ipHash,
    userAgent,
    metadata,
    success: false
  });

  publicRateLimitLogger.warn(
    {
      eventType: 'public_rate_limit_hit',
      ipHash,
      ...metadata
    },
    'public rate limit hit'
  );
}

function normalizeIpCandidate(rawIp: string | undefined | null): string {
  if (!rawIp) {
    return '';
  }

  const firstForwardedIp = rawIp.split(',')[0].trim();
  const bracketedIpv6 = firstForwardedIp.match(/^\[([^\]]+)](?::\d+)?$/);

  if (bracketedIpv6) {
    return bracketedIpv6[1];
  }

  const ipv4WithPort = firstForwardedIp.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);

  if (ipv4WithPort) {
    return ipv4WithPort[1];
  }

  return firstForwardedIp;
}

function sanitizePublicHeaderValue(
  value: string | undefined | null,
  maxLength: number
): string | undefined {
  if (!value) {
    return undefined;
  }

  const sanitized = value.replace(CONTROL_CHARACTERS, '').trim();
  return sanitized ? sanitized.slice(0, maxLength) : undefined;
}

export {
  SlidingWindowMemoryStore,
  getPublicRateLimitKey,
  normalizePublicRateLimitIp,
  publicConvertDailyRateLimiter,
  publicConvertMinuteRateLimiter,
  publicLandingRateLimiter,
  publicSecurityMetadataMiddleware,
  sanitizePublicReferrer,
  sanitizePublicUserAgent
};
