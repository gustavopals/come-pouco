import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Cache } from '../src/utils/cache';

const mocks = vi.hoisted(() => ({
  prisma: {
    company: {
      findFirst: vi.fn()
    },
    user: {
      findFirst: vi.fn()
    },
    conversion: {
      create: vi.fn()
    }
  },
  getShopeePlatformForCompany: vi.fn(),
  getPurchasePlatformById: vi.fn(),
  expandShortlink: vi.fn(),
  generateShopeeShortLinks: vi.fn(),
  logger: (() => {
    const logger = {
      child: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    logger.child.mockReturnValue(logger);
    return logger;
  })()
}));

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

vi.mock('../src/services/company-platform.service', () => ({
  getShopeePlatformForCompany: mocks.getShopeePlatformForCompany
}));

vi.mock('../src/services/purchase-platform.service', () => ({
  getPurchasePlatformById: mocks.getPurchasePlatformById
}));

vi.mock('../src/services/shortlink-expander.service', () => ({
  expandShortlink: mocks.expandShortlink
}));

vi.mock('../src/services/shopee-integration.service', () => ({
  generateShopeeShortLinks: mocks.generateShopeeShortLinks
}));

vi.mock('../src/lib/logger', () => ({
  logger: mocks.logger
}));

import { convertPublicUrl } from '../src/services/public-conversion.service';

const baseCompany = {
  id: 1,
  name: 'Empresa Demo',
  publicSlug: 'empresa-demo',
  fallbackAffiliateUrl: 'https://shopee.com.br/fallback-affiliate',
  shopeePlatformId: 7,
  shopeePlatformTestId: null,
  shopeePlatformProdId: null,
  shopeeMode: 'TEST',
  landingConfig: {
    isActive: true
  }
};

const basePlatform = {
  id: 7,
  name: 'Shopee Mock',
  description: 'Mock',
  type: 'SHOPEE',
  appId: 'app-id',
  secret: 'secret',
  isActive: true,
  mockMode: true,
  apiUrl: 'https://open-api.affiliate.shopee.com.br/graphql',
  apiLink: 'https://open-api.affiliate.shopee.com.br/graphql',
  accessKey: '',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z')
};

const publicInput = {
  url: 'https://shopee.com.br/product/123/456?sub_id=external&foo=bar',
  companySlug: 'Empresa Demo',
  employeeSlug: 'joao',
  ipHash: 'a'.repeat(64),
  userAgent: 'Mozilla/5.0 Test',
  referrer: 'https://instagram.com/post'
};

describe('convertPublicUrl', () => {
  beforeEach(() => {
    mocks.prisma.company.findFirst.mockResolvedValue(baseCompany);
    mocks.prisma.user.findFirst.mockResolvedValue({ id: 22, publicSlug: 'joao' });
    mocks.prisma.conversion.create.mockResolvedValue({});
    mocks.getShopeePlatformForCompany.mockResolvedValue(null);
    mocks.getPurchasePlatformById.mockResolvedValue(basePlatform);
    mocks.expandShortlink.mockResolvedValue({
      finalUrl: 'https://shopee.com.br/product/321/654?xptdk=external&color=blue',
      hops: 1
    });
    mocks.generateShopeeShortLinks.mockResolvedValue([
      {
        originUrl: 'https://shopee.com.br/product/123/456?foo=bar',
        success: true,
        shortLink: 'https://shopee.mock/s/success'
      }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.logger.child.mockReturnValue(mocks.logger);
  });

  it('converts a public product URL through the existing Shopee integration', async () => {
    const result = await convertPublicUrl(publicInput, {
      cache: new Cache({ maxEntries: 10, defaultTtlSec: 60 }),
      awaitPersistence: true,
      requestId: 'req-success'
    });

    expect(result).toMatchObject({
      status: 'SUCCESS',
      affiliateUrl: 'https://shopee.mock/s/success',
      normalizedUrl: 'https://shopee.com.br/product/123/456?foo=bar',
      itemId: '456',
      shopId: '123',
      companySlug: 'empresa-demo',
      employeeSlug: 'joao',
      mode: 'MOCK',
      cacheHit: false
    });

    expect(mocks.generateShopeeShortLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        originUrls: ['https://shopee.com.br/product/123/456?foo=bar'],
        companyId: 1,
        platformId: 7,
        subIds: ['empresa-demo', 'joao', result.conversionId],
        forceMock: true
      })
    );
    expect(mocks.prisma.conversion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: result.conversionId,
        companyId: 1,
        employeeId: 22,
        status: 'SUCCESS',
        mode: 'MOCK',
        itemId: '456',
        shopId: '123',
        affiliateUrl: 'https://shopee.mock/s/success'
      })
    });
  });

  it('falls back when Shopee returns an empty or failed result', async () => {
    mocks.generateShopeeShortLinks.mockResolvedValueOnce([
      {
        originUrl: 'https://shopee.com.br/product/123/456?foo=bar',
        success: false,
        error: 'Shopee unavailable'
      }
    ]);

    const result = await convertPublicUrl(publicInput, {
      cache: null,
      awaitPersistence: true
    });

    expect(result.status).toBe('FALLBACK');
    expect(result.affiliateUrl).toBe(baseCompany.fallbackAffiliateUrl);
    expect(mocks.prisma.conversion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FALLBACK',
        errorReason: 'Shopee unavailable',
        affiliateUrl: baseCompany.fallbackAffiliateUrl
      })
    });
  });

  it('continues as direct when the employee slug is invalid for the company', async () => {
    mocks.prisma.user.findFirst.mockResolvedValueOnce(null);

    const result = await convertPublicUrl(publicInput, {
      cache: null,
      awaitPersistence: true
    });

    expect(result.employeeSlug).toBe('direct');
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'public_conversion_employee_slug_not_found',
        companySlug: 'empresa-demo',
        employeeSlug: 'joao',
        status: 'PENDING',
        responseTimeMs: expect.any(Number)
      }),
      '[public-convert] public conversion employee slug not found'
    );
    expect(mocks.generateShopeeShortLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        subIds: ['empresa-demo', 'direct', result.conversionId]
      })
    );
  });

  it('expands shortlinks before converting and stores the expanded normalized URL', async () => {
    mocks.generateShopeeShortLinks.mockResolvedValueOnce([
      {
        originUrl: 'https://shopee.com.br/product/321/654?color=blue',
        success: true,
        shortLink: 'https://shopee.mock/s/expanded'
      }
    ]);

    const result = await convertPublicUrl(
      {
        ...publicInput,
        url: 'https://shope.ee/abc123?utm_source=social'
      },
      {
        cache: null,
        awaitPersistence: true,
        requestId: 'req-short'
      }
    );

    expect(mocks.expandShortlink).toHaveBeenCalledWith('https://shope.ee/abc123', {
      requestId: 'req-short'
    });
    expect(result).toMatchObject({
      status: 'SUCCESS',
      normalizedUrl: 'https://shopee.com.br/product/321/654?color=blue',
      itemId: '654',
      shopId: '321'
    });
  });

  it('returns cached successful conversions without calling Shopee twice', async () => {
    const cache = new Cache({ maxEntries: 10, defaultTtlSec: 60 });

    const first = await convertPublicUrl(publicInput, {
      cache,
      awaitPersistence: true
    });
    const second = await convertPublicUrl(publicInput, {
      cache,
      awaitPersistence: true
    });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.affiliateUrl).toBe(first.affiliateUrl);
    expect(mocks.generateShopeeShortLinks).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.conversion.create).toHaveBeenCalledTimes(2);
  });

  it('persists invalid URLs as ERROR and rejects the request', async () => {
    await expect(
      convertPublicUrl(
        {
          ...publicInput,
          url: 'https://example.com/not-shopee'
        },
        {
          cache: null,
          awaitPersistence: true
        }
      )
    ).rejects.toMatchObject({
      errorCode: 'PUBLIC_INVALID_SHOPEE_URL'
    });

    expect(mocks.prisma.conversion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'ERROR',
        errorReason: 'NON_SHOPEE_DOMAIN'
      })
    });
  });
});
