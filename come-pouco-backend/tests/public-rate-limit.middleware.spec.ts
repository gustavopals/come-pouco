import type { Options } from 'express-rate-limit';
import { describe, expect, it, vi } from 'vitest';

import {
  SlidingWindowMemoryStore,
  normalizePublicRateLimitIp,
  sanitizePublicReferrer,
  sanitizePublicUserAgent
} from '../src/middlewares/public-rate-limit.middleware';

describe('public rate limit helpers', () => {
  it('normalizes IPv4 and IPv4-mapped IPv6 addresses', () => {
    expect(normalizePublicRateLimitIp('192.168.15.10')).toBe('192.168.15.10');
    expect(normalizePublicRateLimitIp('::ffff:192.168.15.10')).toBe('192.168.15.10');
    expect(normalizePublicRateLimitIp('192.168.15.10:12345')).toBe('192.168.15.10');
  });

  it('masks IPv6 addresses to /64 for rate limit keys', () => {
    const first = normalizePublicRateLimitIp('2001:db8:abcd:12:1111:2222:3333:4444');
    const second = normalizePublicRateLimitIp('2001:db8:abcd:12:aaaa:bbbb:cccc:dddd');

    expect(first).toBe('2001:db8:abcd:12:0:0:0:0');
    expect(second).toBe(first);
  });

  it('sanitizes public metadata headers', () => {
    const userAgent = sanitizePublicUserAgent(`Mozilla/5.0\u0000\n${'a'.repeat(300)}`);
    const referrer = sanitizePublicReferrer(`https://example.com/path\r\n${'b'.repeat(2100)}`);

    expect(userAgent).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
    expect(userAgent).toHaveLength(256);
    expect(referrer).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
    expect(referrer).toHaveLength(2048);
  });
});

describe('SlidingWindowMemoryStore', () => {
  it('expires hits relative to the oldest request in the window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));

    try {
      const store = new SlidingWindowMemoryStore();
      store.init({ windowMs: 1000 } as Options);

      expect(await store.increment('ip:a')).toMatchObject({ totalHits: 1 });

      vi.advanceTimersByTime(500);
      const second = await store.increment('ip:a');
      expect(second.totalHits).toBe(2);
      expect(second.resetTime?.toISOString()).toBe('2026-05-21T12:00:01.000Z');

      vi.advanceTimersByTime(501);
      const third = await store.increment('ip:a');
      expect(third.totalHits).toBe(2);
      expect(third.resetTime?.toISOString()).toBe('2026-05-21T12:00:01.500Z');
    } finally {
      vi.useRealTimers();
    }
  });
});
