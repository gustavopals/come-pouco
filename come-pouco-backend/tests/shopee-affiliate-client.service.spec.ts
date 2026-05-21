import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

import { postGraphql } from '../src/services/shopee-affiliate-client.service';

const makeResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

describe('postGraphql', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_777_777_777_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signs the Shopee GraphQL request with the expected SHA256 header', async () => {
    const fetchMock = vi.fn(async () => makeResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const body = {
      query: 'query Test { ok }',
      variables: { originUrl: 'https://shopee.com.br/product/1/2' }
    };
    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHash('sha256')
      .update(`app-id${Date.now()}${payload}secret-key`)
      .digest('hex');

    const response = await postGraphql<{ ok: boolean }>({
      appId: 'app-id',
      secret: 'secret-key',
      apiUrl: 'https://open-api.affiliate.shopee.com.br/graphql',
      body
    });

    expect(response.data?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://open-api.affiliate.shopee.com.br/graphql',
      expect.objectContaining({
        method: 'POST',
        body: payload,
        headers: expect.objectContaining({
          Authorization: `SHA256 Credential=app-id, Timestamp=${Date.now()}, Signature=${expectedSignature}`
        })
      })
    );
  });

  it('maps Shopee HTTP errors and GraphQL errors to HttpError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse({ message: 'bad gateway' }, 502))
    );

    await expect(
      postGraphql({
        appId: 'app',
        secret: 'secret',
        apiUrl: 'https://example.test/graphql',
        body: { query: '{}' }
      })
    ).rejects.toMatchObject({ statusCode: 502 });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse({ errors: [{ message: 'Shopee rejected' }] }))
    );

    await expect(
      postGraphql({
        appId: 'app',
        secret: 'secret',
        apiUrl: 'https://example.test/graphql',
        body: { query: '{}' }
      })
    ).rejects.toMatchObject({ statusCode: 502, message: 'Shopee rejected' });
  });

  it('maps timeout-like fetch failures to 504', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(timeout))
    );

    await expect(
      postGraphql({
        appId: 'app',
        secret: 'secret',
        apiUrl: 'https://example.test/graphql',
        body: { query: '{}' }
      })
    ).rejects.toMatchObject({ statusCode: 504 });
  });
});
