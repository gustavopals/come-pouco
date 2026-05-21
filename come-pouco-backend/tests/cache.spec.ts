import { describe, expect, it, vi } from 'vitest';

import { Cache } from '../src/utils/cache';

describe('Cache', () => {
  it('stores values with hit and miss counters', () => {
    const cache = new Cache({ maxEntries: 10, defaultTtlSec: 60 });

    expect(cache.get('missing')).toBeUndefined();
    cache.set('answer', { value: 42 });

    expect(cache.get<{ value: number }>('answer')).toEqual({ value: 42 });
    expect(cache.stats()).toEqual({
      hits: 1,
      misses: 1,
      size: 1
    });
  });

  it('evicts least-recently-used entries by configured max size', () => {
    const cache = new Cache({ maxEntries: 2, defaultTtlSec: 60 });

    cache.set('a', { value: 'a' });
    cache.set('b', { value: 'b' });
    expect(cache.get('a')).toEqual({ value: 'a' });
    cache.set('c', { value: 'c' });

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toEqual({ value: 'a' });
    expect(cache.get('c')).toEqual({ value: 'c' });
  });

  it('expires values by ttl', async () => {
    const cache = new Cache({ maxEntries: 10, defaultTtlSec: 60 });

    cache.set('short', { ok: true }, 0.001);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(cache.get('short')).toBeUndefined();
  });

  it('shares concurrent getOrSet calls for the same key', async () => {
    const cache = new Cache({ maxEntries: 10, defaultTtlSec: 60 });
    const factory = vi.fn(async () => ({ value: Math.random() }));

    const [first, second] = await Promise.all([
      cache.getOrSet('shared', factory),
      cache.getOrSet('shared', factory)
    ]);

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(cache.get('shared')).toBe(first);
  });

  it('deletes cached and pending entries', async () => {
    const cache = new Cache({ maxEntries: 10, defaultTtlSec: 60 });

    cache.set('item', { value: true });
    cache.delete('item');

    expect(cache.get('item')).toBeUndefined();
  });
});
