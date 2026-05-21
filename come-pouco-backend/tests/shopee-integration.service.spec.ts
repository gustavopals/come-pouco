import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    shopeeMock: false,
    shopeeMockFailurePattern: null as string | null
  },
  prisma: {
    apiRequestLog: {
      createMany: vi.fn()
    }
  },
  postGraphql: vi.fn()
}));

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

vi.mock('../src/config/env', () => ({
  default: mocks.env
}));

vi.mock('../src/services/shopee-affiliate-client.service', () => ({
  postGraphql: mocks.postGraphql
}));

import { generateShopeeShortLinks } from '../src/services/shopee-integration.service';

const input = {
  appId: 'app-id',
  secret: 'secret',
  apiUrl: 'https://open-api.affiliate.shopee.com.br/graphql',
  originUrls: ['https://shopee.com.br/product/1/2'],
  companyId: 10,
  userId: 7,
  platformId: 3,
  subIds: [' loja ', ' creator ', ' extra ', ' ignored ']
};

describe('generateShopeeShortLinks', () => {
  beforeEach(() => {
    mocks.env.shopeeMock = false;
    mocks.env.shopeeMockFailurePattern = null;
    vi.spyOn(Date, 'now').mockReturnValue(1_777_777_777_000);
    mocks.prisma.apiRequestLog.createMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns deterministic mock shortlinks for a fixed timestamp and writes MOCK usage logs', async () => {
    const first = await generateShopeeShortLinks({ ...input, forceMock: true });
    const second = await generateShopeeShortLinks({ ...input, forceMock: true });

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      originUrl: input.originUrls[0],
      success: true,
      shortLink: expect.stringMatching(/^https:\/\/shopee\.mock\/s\/[a-f0-9]{12}$/)
    });
    expect(mocks.prisma.apiRequestLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: 10,
          userId: 7,
          platformId: 3,
          mode: 'MOCK',
          endpoint: input.apiUrl,
          success: true
        })
      ]
    });
  });

  it('posts real GraphQL requests with normalized subIds and parses shortLink response', async () => {
    mocks.postGraphql.mockResolvedValue({
      data: {
        generateShortLink: {
          shortLink: 'https://s.shopee.com.br/real',
          originUrl: input.originUrls[0]
        }
      }
    });

    const result = await generateShopeeShortLinks(input);

    expect(result).toEqual([
      {
        originUrl: input.originUrls[0],
        success: true,
        shortLink: 'https://s.shopee.com.br/real'
      }
    ]);
    expect(mocks.postGraphql).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          variables: {
            originUrl: input.originUrls[0],
            subIds: ['loja', 'creator', 'extra']
          }
        })
      })
    );
    expect(mocks.prisma.apiRequestLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ mode: 'REAL', success: true })]
    });
  });

  it('returns failed results for Shopee errors and logs failed REAL attempts', async () => {
    mocks.postGraphql.mockRejectedValue(new Error('Shopee unavailable'));

    const result = await generateShopeeShortLinks(input);

    expect(result).toEqual([
      {
        originUrl: input.originUrls[0],
        success: false,
        error: 'Shopee unavailable'
      }
    ]);
    expect(mocks.prisma.apiRequestLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ mode: 'REAL', success: false })]
    });
  });

  it('does not write usage logs when company or user context is missing', async () => {
    const result = await generateShopeeShortLinks({
      ...input,
      companyId: undefined,
      userId: undefined,
      forceMock: true
    });

    expect(result[0].success).toBe(true);
    expect(mocks.prisma.apiRequestLog.createMany).not.toHaveBeenCalled();
  });

  it('can force failed results in mock mode for E2E fallback coverage', async () => {
    mocks.env.shopeeMockFailurePattern = 'force-fallback';

    const result = await generateShopeeShortLinks({
      ...input,
      originUrls: ['https://shopee.com.br/product/1/2?force-fallback=1'],
      forceMock: true
    });

    expect(result).toEqual([
      {
        originUrl: 'https://shopee.com.br/product/1/2?force-fallback=1',
        success: false,
        error: 'SHOPEE_MOCK_FORCED_FAILURE'
      }
    ]);
    expect(mocks.prisma.apiRequestLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ mode: 'MOCK', success: false })]
    });
  });
});
