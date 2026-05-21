import { LRUCache } from 'lru-cache';

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

interface CacheOptions {
  maxEntries: number;
  defaultTtlSec: number;
}

class Cache {
  private hits = 0;
  private misses = 0;
  private readonly store: LRUCache<string, {}>;
  private readonly pending = new Map<string, Promise<{}>>();
  private readonly defaultTtlMs: number;

  constructor({ maxEntries, defaultTtlSec }: CacheOptions) {
    this.defaultTtlMs = defaultTtlSec * 1000;
    this.store = new LRUCache<string, {}>({
      maxSize: maxEntries,
      sizeCalculation: () => 1,
      ttl: this.defaultTtlMs
    });
  }

  get<T extends {}>(key: string): T | undefined {
    const value = this.store.get(key);

    if (value === undefined) {
      this.misses += 1;
      return undefined;
    }

    this.hits += 1;
    return value as T;
  }

  set<T extends {}>(key: string, value: T, ttlSec?: number): void {
    this.store.set(key, value, {
      ttl: ttlSec === undefined ? this.defaultTtlMs : ttlSec * 1000
    });
  }

  delete(key: string): void {
    this.store.delete(key);
    this.pending.delete(key);
  }

  async getOrSet<T extends {}>(
    key: string,
    factory: () => Promise<T>,
    ttlSec?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.pending.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const request = factory()
      .then((value) => {
        this.set(key, value, ttlSec);
        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, request);
    return request;
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size
    };
  }
}

export { Cache };
export type { CacheOptions, CacheStats };
