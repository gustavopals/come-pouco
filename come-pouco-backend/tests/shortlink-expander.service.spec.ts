import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Cache } from '../src/utils/cache';
import {
  ShortlinkExpansionError,
  expandShortlink
} from '../src/services/shortlink-expander.service';

type FetchMock = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => ReturnType<typeof fetch>;
type MockFetch = ReturnType<typeof vi.fn<FetchMock>>;

const createFetchMock = (responses: Array<Response | Error>): MockFetch =>
  vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();

    if (!response) {
      throw new Error(`Unexpected fetch call to ${String(input)} with ${init?.method}`);
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  });

const response = (status: number, headers?: HeadersInit): Response =>
  new Response(null, { status, headers });

describe('expandShortlink', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expands a shortlink by manually following redirects', async () => {
    const fetchImpl = createFetchMock([
      response(302, { location: 'https://shopee.com.br/product/123/456?sub_id=external' }),
      response(200)
    ]);

    const result = await expandShortlink('https://shope.ee/abc123?utm_source=social', {
      fetchImpl,
      cache: null,
      requestId: 'req-1'
    });

    expect(result).toEqual({
      finalUrl: 'https://shopee.com.br/product/123/456?sub_id=external',
      hops: 1
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(['HEAD', 'HEAD']);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://shope.ee/abc123');
  });

  it('expands br.shp.ee shortlinks', async () => {
    const fetchImpl = createFetchMock([
      response(302, { location: 'https://shopee.com.br/product/555/777' }),
      response(200)
    ]);

    const result = await expandShortlink('https://br.shp.ee/9ZkLmN4pQ', {
      fetchImpl,
      cache: null
    });

    expect(result).toEqual({
      finalUrl: 'https://shopee.com.br/product/555/777',
      hops: 1
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://br.shp.ee/9ZkLmN4pQ');
  });

  it('falls back from HEAD to GET when HEAD is blocked', async () => {
    const fetchImpl = createFetchMock([
      response(405),
      response(302, { location: '/product/999/888' }),
      response(200)
    ]);

    const result = await expandShortlink('https://s.shopee.com.br/blocked', {
      fetchImpl,
      cache: null
    });

    expect(result).toEqual({
      finalUrl: 'https://s.shopee.com.br/product/999/888',
      hops: 1
    });
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(['HEAD', 'GET', 'HEAD']);
  });

  it('uses the cache for repeated shortlink expansions', async () => {
    const cache = new Cache({ maxEntries: 10, defaultTtlSec: 60 });
    const fetchImpl = createFetchMock([
      response(302, { location: 'https://shopee.com.br/fone-i.1.2' }),
      response(200)
    ]);

    const first = await expandShortlink('https://shope.ee/cache-me', { fetchImpl, cache });
    const second = await expandShortlink('https://shope.ee/cache-me', { fetchImpl, cache });

    expect(first).toEqual(second);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(cache.stats()).toMatchObject({
      hits: 1,
      size: 1
    });
  });

  it('rejects non-shortlink URLs', async () => {
    await expect(
      expandShortlink('https://shopee.com.br/product/1/2', { cache: null })
    ).rejects.toMatchObject({
      code: 'SHORTLINK_INVALID'
    });
  });

  it('maps fetch timeout errors to SHORTLINK_TIMEOUT', async () => {
    const timeoutError = new Error('timed out');
    timeoutError.name = 'TimeoutError';
    const fetchImpl = createFetchMock([timeoutError]);

    await expect(
      expandShortlink('https://shope.ee/timeout', { fetchImpl, cache: null })
    ).rejects.toMatchObject({
      code: 'SHORTLINK_TIMEOUT'
    });
  });

  it('maps unreachable final responses to SHORTLINK_UNREACHABLE', async () => {
    const fetchImpl = createFetchMock([response(404), response(404)]);

    await expect(
      expandShortlink('https://shope.ee/not-found', { fetchImpl, cache: null })
    ).rejects.toMatchObject({
      code: 'SHORTLINK_UNREACHABLE'
    });
  });

  it('detects redirect loops', async () => {
    const fetchImpl = createFetchMock([
      response(302, { location: 'https://shope.ee/again' }),
      response(302, { location: 'https://shope.ee/loop' })
    ]);

    await expect(
      expandShortlink('https://shope.ee/loop', { fetchImpl, cache: null })
    ).rejects.toMatchObject({
      code: 'SHORTLINK_LOOP'
    });
  });

  it('stops after the configured redirect limit', async () => {
    const fetchImpl = createFetchMock([
      response(302, { location: 'https://shopee.com.br/a' }),
      response(302, { location: 'https://shopee.com.br/b' }),
      response(302, { location: 'https://shopee.com.br/c' })
    ]);

    await expect(
      expandShortlink('https://shope.ee/too-many', { fetchImpl, cache: null, maxHops: 2 })
    ).rejects.toMatchObject({
      code: 'SHORTLINK_LOOP'
    });
  });

  it('exposes a typed shortlink expansion error', () => {
    const error = new ShortlinkExpansionError('SHORTLINK_UNREACHABLE', 'unreachable');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ShortlinkExpansionError');
    expect(error.code).toBe('SHORTLINK_UNREACHABLE');
  });
});
