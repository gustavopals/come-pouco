import crypto from 'node:crypto';

import env from '../config/env';
import prisma from '../config/prisma';
import { slugifyPublicSlug } from '../config/reserved-slugs';
import { publicCache } from '../cache/public.cache';
import { logger } from '../lib/logger';
import { recordConversion } from '../lib/metrics';
import type { Cache } from '../utils/cache';
import HttpError from '../utils/httpError';
import * as companyPlatformService from './company-platform.service';
import * as purchasePlatformService from './purchase-platform.service';
import { expandShortlink } from './shortlink-expander.service';
import { generateShopeeShortLinks } from './shopee-integration.service';
import { parseShopeeUrl } from './shopee-url-parser.service';
import type { ShopeeUrlAnalysis } from '../types/shopee-url';

type ConversionStatus = 'SUCCESS' | 'FALLBACK' | 'ERROR' | 'BOT_DETECTED';
type ConversionMode = 'MOCK' | 'REAL';

interface ConvertPublicUrlInput {
  url: string;
  companySlug: string;
  employeeSlug?: string;
  ipHash: string;
  userAgent: string;
  referrer?: string;
}

interface ConversionResult {
  conversionId: string;
  status: Exclude<ConversionStatus, 'ERROR'>;
  affiliateUrl: string;
  originalUrl: string;
  normalizedUrl?: string;
  itemId?: string;
  shopId?: string;
  productName?: string;
  companySlug: string;
  employeeSlug: string;
  mode: ConversionMode;
  cacheHit: boolean;
  responseTimeMs: number;
}

interface PublicConversionOptions {
  requestId?: string;
  cache?: Cache | null;
  awaitPersistence?: boolean;
  expandShortlinkFn?: typeof expandShortlink;
  generateShortLinksFn?: typeof generateShopeeShortLinks;
}

interface RecordBotDetectedConversionInput {
  url: string;
  companySlug: string;
  ipHash: string;
  userAgent: string;
  referrer?: string;
}

type CompanyForPublicConversion = NonNullable<Awaited<ReturnType<typeof findCompanyBySlug>>>;
type PlatformForPublicConversion = NonNullable<Awaited<ReturnType<typeof resolveShopeePlatform>>>;

interface ConversionCacheValue {
  affiliateUrl: string;
  itemId?: string;
  shopId?: string;
  productName?: string;
  normalizedUrl: string;
  mode: ConversionMode;
}

interface PersistConversionInput {
  id: string;
  companyId: number;
  employeeId: number | null;
  originalUrl: string;
  normalizedUrl?: string;
  affiliateUrl?: string;
  itemId?: string;
  shopId?: string;
  productName?: string;
  status: ConversionStatus;
  errorReason?: string;
  mode: ConversionMode;
  ipHash: string;
  userAgent: string;
  referrer?: string;
  responseTimeMs: number;
  requestId?: string | null;
  companySlug?: string | null;
  employeeSlug?: string | null;
}

const DIRECT_EMPLOYEE_SLUG = 'direct';
const PUBLIC_CONVERT_LOG_PREFIX = '[public-convert]';
const publicConversionLogger = logger.child({ scope: 'public-convert' });

const recordBotDetectedConversion = async (
  input: RecordBotDetectedConversionInput,
  options: Pick<PublicConversionOptions, 'requestId' | 'awaitPersistence'> = {}
): Promise<{ conversionId: string; affiliateUrl: string }> => {
  const startedAt = Date.now();
  const conversionId = crypto.randomUUID();
  const company = await findCompanyBySlug(normalizeSlug(input.companySlug));
  const affiliateUrl = company?.fallbackAffiliateUrl || input.url;

  if (!company) {
    const responseTimeMs = Date.now() - startedAt;
    publicConversionLogger.warn(
      {
        eventType: 'public_conversion_bot_company_not_found',
        requestId: options.requestId ?? null,
        conversionId,
        companySlug: input.companySlug,
        employeeSlug: DIRECT_EMPLOYEE_SLUG,
        status: 'BOT_DETECTED',
        responseTimeMs
      },
      `${PUBLIC_CONVERT_LOG_PREFIX} bot-detected conversion ignored because company was not found`
    );
    return { conversionId, affiliateUrl };
  }

  const responseTimeMs = Date.now() - startedAt;
  await persistConversion(
    {
      id: conversionId,
      companyId: company.id,
      employeeId: null,
      originalUrl: input.url,
      affiliateUrl,
      status: 'BOT_DETECTED',
      errorReason: 'HONEYPOT_FILLED',
      mode: 'MOCK',
      ipHash: input.ipHash.slice(0, 64),
      userAgent: sanitizeMetadataString(input.userAgent, 256),
      referrer: sanitizeOptionalMetadataString(input.referrer, 2048),
      responseTimeMs,
      requestId: options.requestId ?? null,
      companySlug: company.publicSlug,
      employeeSlug: DIRECT_EMPLOYEE_SLUG
    },
    options.awaitPersistence
  );

  publicConversionLogger.warn(
    {
      eventType: 'public_conversion_bot_detected',
      requestId: options.requestId ?? null,
      conversionId,
      companySlug: company.publicSlug,
      employeeSlug: DIRECT_EMPLOYEE_SLUG,
      status: 'BOT_DETECTED',
      responseTimeMs
    },
    `${PUBLIC_CONVERT_LOG_PREFIX} bot-detected conversion persisted`
  );

  return { conversionId, affiliateUrl };
};

const convertPublicUrl = async (
  input: ConvertPublicUrlInput,
  options: PublicConversionOptions = {}
): Promise<ConversionResult> => {
  const startedAt = Date.now();
  const conversionId = crypto.randomUUID();
  const companySlug = normalizeSlug(input.companySlug);
  const requestedEmployeeSlug = normalizeOptionalSlug(input.employeeSlug);
  const company = await findCompanyBySlug(companySlug);

  if (!company || !company.landingConfig?.isActive) {
    publicConversionLogger.warn(
      {
        eventType: 'public_conversion_landing_not_found',
        requestId: options.requestId ?? null,
        conversionId,
        companySlug,
        employeeSlug: requestedEmployeeSlug ?? DIRECT_EMPLOYEE_SLUG,
        status: 'ERROR',
        responseTimeMs: Date.now() - startedAt
      },
      `${PUBLIC_CONVERT_LOG_PREFIX} public conversion landing not found`
    );
    throw new HttpError(404, 'Landing publica nao encontrada.', 'PUBLIC_LANDING_NOT_FOUND');
  }

  const employee = requestedEmployeeSlug
    ? await findEmployeeBySlug(company.id, requestedEmployeeSlug)
    : null;
  const employeeSlug = employee?.publicSlug ?? DIRECT_EMPLOYEE_SLUG;

  if (requestedEmployeeSlug && !employee) {
    publicConversionLogger.warn(
      {
        eventType: 'public_conversion_employee_slug_not_found',
        requestId: options.requestId ?? null,
        companySlug,
        employeeSlug: requestedEmployeeSlug,
        status: 'PENDING',
        responseTimeMs: Date.now() - startedAt
      },
      `${PUBLIC_CONVERT_LOG_PREFIX} public conversion employee slug not found`
    );
  }

  const initialAnalysis = parseShopeeUrl(input.url);
  if (!initialAnalysis.valid) {
    const responseTimeMs = Date.now() - startedAt;
    await persistConversion(
      {
        id: conversionId,
        companyId: company.id,
        employeeId: employee?.id ?? null,
        originalUrl: input.url,
        status: 'ERROR',
        errorReason: initialAnalysis.reason ?? 'INVALID_SHOPEE_URL',
        mode: 'MOCK',
        ipHash: input.ipHash,
        userAgent: sanitizeMetadataString(input.userAgent, 256),
        referrer: sanitizeOptionalMetadataString(input.referrer, 2048),
        responseTimeMs,
        requestId: options.requestId ?? null,
        companySlug,
        employeeSlug
      },
      options.awaitPersistence
    );
    publicConversionLogger.warn(
      {
        eventType: 'public_conversion_invalid_url',
        requestId: options.requestId ?? null,
        conversionId,
        companySlug,
        employeeSlug,
        status: 'ERROR',
        responseTimeMs,
        errorReason: initialAnalysis.reason ?? 'INVALID_SHOPEE_URL'
      },
      `${PUBLIC_CONVERT_LOG_PREFIX} public conversion invalid url`
    );
    throw new HttpError(400, 'URL Shopee invalida.', 'PUBLIC_INVALID_SHOPEE_URL');
  }

  let resolvedAnalysis = initialAnalysis;
  let normalizedUrl = initialAnalysis.normalizedUrl ?? input.url.trim();
  let mode: ConversionMode = env.shopeeMock ? 'MOCK' : 'REAL';

  try {
    resolvedAnalysis = await resolveFinalShopeeAnalysis(initialAnalysis, options);
    normalizedUrl = resolvedAnalysis.normalizedUrl ?? input.url.trim();
    const productName = extractProductName(resolvedAnalysis);

    const platform = await resolveShopeePlatform(company);
    mode = platform.mockMode || env.shopeeMock ? 'MOCK' : 'REAL';
    const cache = options.cache === undefined ? publicCache : options.cache;
    const cacheKey = buildConversionCacheKey({
      companyId: company.id,
      platformId: platform.id,
      employeeSlug,
      mode,
      normalizedUrl
    });

    const cached = cache?.get<ConversionCacheValue>(cacheKey);
    if (cached) {
      const responseTimeMs = Date.now() - startedAt;
      const result = toSuccessResult({
        conversionId,
        companySlug,
        employeeSlug,
        originalUrl: input.url,
        cacheHit: true,
        responseTimeMs,
        cached
      });

      await persistConversion(
        buildConversionPersistence({
          id: conversionId,
          company,
          employeeId: employee?.id ?? null,
          employeeSlug,
          input,
          status: 'SUCCESS',
          mode: cached.mode,
          startedAt,
          responseTimeMs,
          requestId: options.requestId ?? null,
          normalizedUrl: cached.normalizedUrl,
          affiliateUrl: cached.affiliateUrl,
          itemId: cached.itemId,
          shopId: cached.shopId,
          productName: cached.productName
        }),
        options.awaitPersistence
      );

      logPublicConversion('cache_hit', options.requestId, result);
      return result;
    }

    const generated = await callShopeeGenerateShortlink({
      company,
      platform,
      conversionId,
      employeeSlug,
      normalizedUrl,
      generateShortLinksFn: options.generateShortLinksFn ?? generateShopeeShortLinks
    });

    if (generated.success && generated.shortLink) {
      const responseTimeMs = Date.now() - startedAt;
      const cacheValue: ConversionCacheValue = {
        affiliateUrl: generated.shortLink,
        normalizedUrl,
        itemId: resolvedAnalysis.itemId,
        shopId: resolvedAnalysis.shopId,
        productName,
        mode
      };
      cache?.set(cacheKey, cacheValue, 30 * 60);

      const result = toSuccessResult({
        conversionId,
        companySlug,
        employeeSlug,
        originalUrl: input.url,
        cacheHit: false,
        responseTimeMs,
        cached: cacheValue
      });

      await persistConversion(
        buildConversionPersistence({
          id: conversionId,
          company,
          employeeId: employee?.id ?? null,
          employeeSlug,
          input,
          status: 'SUCCESS',
          mode,
          startedAt,
          responseTimeMs,
          requestId: options.requestId ?? null,
          normalizedUrl,
          affiliateUrl: generated.shortLink,
          itemId: resolvedAnalysis.itemId,
          shopId: resolvedAnalysis.shopId,
          productName
        }),
        options.awaitPersistence
      );

      logPublicConversion('success', options.requestId, result);
      return result;
    }

    return await fallbackResult({
      conversionId,
      company,
      employeeId: employee?.id ?? null,
      companySlug,
      employeeSlug,
      input,
      mode,
      startedAt,
      normalizedUrl,
      itemId: resolvedAnalysis.itemId,
      shopId: resolvedAnalysis.shopId,
      productName,
      errorReason: generated.error ?? 'SHOPEE_EMPTY_RESPONSE',
      options
    });
  } catch (error) {
    if (error instanceof HttpError && error.errorCode === 'PUBLIC_FALLBACK_URL_MISSING') {
      throw error;
    }

    return await fallbackResult({
      conversionId,
      company,
      employeeId: employee?.id ?? null,
      companySlug,
      employeeSlug,
      input,
      mode,
      startedAt,
      normalizedUrl,
      itemId: resolvedAnalysis.itemId,
      shopId: resolvedAnalysis.shopId,
      productName: extractProductName(resolvedAnalysis),
      errorReason: normalizeErrorReason(error),
      options
    });
  }
};

const findCompanyBySlug = async (publicSlug: string) => {
  return prisma.company.findFirst({
    where: { publicSlug },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      fallbackAffiliateUrl: true,
      shopeePlatformId: true,
      shopeePlatformTestId: true,
      shopeePlatformProdId: true,
      shopeeMode: true,
      landingConfig: {
        select: {
          isActive: true
        }
      }
    }
  });
};

const findEmployeeBySlug = async (companyId: number, publicSlug: string) => {
  return prisma.user.findFirst({
    where: {
      companyId,
      publicSlug,
      role: 'USER'
    },
    select: {
      id: true,
      publicSlug: true
    }
  });
};

const resolveShopeePlatform = async (company: CompanyForPublicConversion) => {
  const linkedPlatform = await companyPlatformService.getShopeePlatformForCompany(company.id);
  const platformId =
    linkedPlatform?.id ??
    (company.shopeeMode === 'PROD' ? company.shopeePlatformProdId : company.shopeePlatformTestId) ??
    company.shopeePlatformId;

  if (!platformId) {
    throw new HttpError(
      400,
      'Empresa sem plataforma Shopee configurada.',
      'PUBLIC_SHOPEE_PLATFORM_MISSING'
    );
  }

  const platform = await purchasePlatformService.getPurchasePlatformById(platformId);

  if (!platform) {
    throw new HttpError(
      404,
      'Plataforma Shopee nao encontrada.',
      'PUBLIC_SHOPEE_PLATFORM_NOT_FOUND'
    );
  }

  if (!platform.isActive) {
    throw new HttpError(403, 'Plataforma Shopee inativa.', 'PUBLIC_SHOPEE_PLATFORM_INACTIVE');
  }

  if (platform.type !== 'SHOPEE') {
    throw new HttpError(
      400,
      'Plataforma configurada nao e Shopee.',
      'PUBLIC_SHOPEE_PLATFORM_INVALID'
    );
  }

  const shouldUseMock = platform.mockMode || env.shopeeMock;
  if (!shouldUseMock && (!platform.appId.trim() || !platform.secret.trim())) {
    throw new HttpError(
      400,
      'Plataforma Shopee sem credenciais completas.',
      'PUBLIC_SHOPEE_CREDENTIALS_MISSING'
    );
  }

  if (!isHttpUrl(platform.apiUrl)) {
    throw new HttpError(400, 'Link da API Shopee invalido.', 'PUBLIC_SHOPEE_API_URL_INVALID');
  }

  return platform;
};

const resolveFinalShopeeAnalysis = async (
  analysis: ShopeeUrlAnalysis,
  options: PublicConversionOptions
): Promise<ShopeeUrlAnalysis> => {
  if (analysis.kind !== 'short') {
    return analysis;
  }

  const expansion = await (options.expandShortlinkFn ?? expandShortlink)(
    analysis.normalizedUrl ?? analysis.originalUrl,
    {
      requestId: options.requestId
    }
  );
  const expandedAnalysis = parseShopeeUrl(expansion.finalUrl);

  if (!expandedAnalysis.valid) {
    throw new HttpError(
      400,
      'Shortlink Shopee expandiu para URL invalida.',
      'PUBLIC_SHORTLINK_INVALID_TARGET'
    );
  }

  return expandedAnalysis;
};

const callShopeeGenerateShortlink = async ({
  company,
  platform,
  conversionId,
  employeeSlug,
  normalizedUrl,
  generateShortLinksFn
}: {
  company: CompanyForPublicConversion;
  platform: PlatformForPublicConversion;
  conversionId: string;
  employeeSlug: string;
  normalizedUrl: string;
  generateShortLinksFn: typeof generateShopeeShortLinks;
}) => {
  const results = await generateShortLinksFn({
    appId: platform.appId,
    secret: platform.secret,
    apiUrl: platform.apiUrl,
    originUrls: [normalizedUrl],
    companyId: company.id,
    platformId: platform.id,
    subIds: [company.publicSlug!, employeeSlug, conversionId],
    forceMock: platform.mockMode
  });

  return results[0] ?? { originUrl: normalizedUrl, success: false, error: 'SHOPEE_EMPTY_RESPONSE' };
};

const fallbackResult = async ({
  conversionId,
  company,
  employeeId,
  companySlug,
  employeeSlug,
  input,
  mode,
  startedAt,
  normalizedUrl,
  itemId,
  shopId,
  productName,
  errorReason,
  options
}: {
  conversionId: string;
  company: CompanyForPublicConversion;
  employeeId: number | null;
  companySlug: string;
  employeeSlug: string;
  input: ConvertPublicUrlInput;
  mode: ConversionMode;
  startedAt: number;
  normalizedUrl?: string;
  itemId?: string;
  shopId?: string;
  productName?: string;
  errorReason: string;
  options: PublicConversionOptions;
}): Promise<ConversionResult> => {
  if (!company.fallbackAffiliateUrl) {
    const responseTimeMs = Date.now() - startedAt;
    await persistConversion(
      buildConversionPersistence({
        id: conversionId,
        company,
        employeeId,
        employeeSlug,
        input,
        status: 'ERROR',
        mode,
        startedAt,
        responseTimeMs,
        requestId: options.requestId ?? null,
        normalizedUrl,
        itemId,
        shopId,
        productName,
        errorReason: 'FALLBACK_URL_MISSING'
      }),
      options.awaitPersistence
    );
    publicConversionLogger.error(
      {
        eventType: 'public_conversion_fallback_url_missing',
        requestId: options.requestId ?? null,
        conversionId,
        companySlug,
        employeeSlug,
        status: 'ERROR',
        mode,
        cacheHit: false,
        responseTimeMs,
        errorReason: 'FALLBACK_URL_MISSING'
      },
      `${PUBLIC_CONVERT_LOG_PREFIX} public conversion fallback url missing`
    );
    throw new HttpError(
      400,
      'Empresa sem URL de fallback configurada.',
      'PUBLIC_FALLBACK_URL_MISSING'
    );
  }

  const responseTimeMs = Date.now() - startedAt;
  const result: ConversionResult = {
    conversionId,
    status: 'FALLBACK',
    affiliateUrl: company.fallbackAffiliateUrl,
    originalUrl: input.url,
    normalizedUrl,
    itemId,
    shopId,
    productName,
    companySlug,
    employeeSlug,
    mode,
    cacheHit: false,
    responseTimeMs
  };

  await persistConversion(
    buildConversionPersistence({
      id: conversionId,
      company,
      employeeId,
      employeeSlug,
      input,
      status: 'FALLBACK',
      mode,
      startedAt,
      responseTimeMs,
      requestId: options.requestId ?? null,
      normalizedUrl,
      affiliateUrl: company.fallbackAffiliateUrl,
      itemId,
      shopId,
      productName,
      errorReason
    }),
    options.awaitPersistence
  );

  logPublicConversion('fallback', options.requestId, result, { errorReason });
  return result;
};

const buildConversionPersistence = ({
  id,
  company,
  employeeId,
  employeeSlug,
  input,
  status,
  mode,
  startedAt,
  responseTimeMs,
  requestId,
  normalizedUrl,
  affiliateUrl,
  itemId,
  shopId,
  productName,
  errorReason
}: {
  id: string;
  company: CompanyForPublicConversion;
  employeeId: number | null;
  employeeSlug: string;
  input: ConvertPublicUrlInput;
  status: ConversionStatus;
  mode: ConversionMode;
  startedAt: number;
  responseTimeMs?: number;
  requestId?: string | null;
  normalizedUrl?: string;
  affiliateUrl?: string;
  itemId?: string;
  shopId?: string;
  productName?: string;
  errorReason?: string;
}): PersistConversionInput => ({
  id,
  companyId: company.id,
  employeeId,
  originalUrl: input.url,
  normalizedUrl,
  affiliateUrl,
  itemId,
  shopId,
  productName,
  status,
  errorReason,
  mode,
  ipHash: input.ipHash.slice(0, 64),
  userAgent: sanitizeMetadataString(input.userAgent, 256),
  referrer: sanitizeOptionalMetadataString(input.referrer, 2048),
  responseTimeMs: responseTimeMs ?? Date.now() - startedAt,
  requestId,
  companySlug: company.publicSlug,
  employeeSlug
});

const persistConversion = (
  data: PersistConversionInput,
  awaitPersistence = false
): Promise<void> | void => {
  const write = prisma.conversion
    .create({
      data: {
        id: data.id,
        companyId: data.companyId,
        employeeId: data.employeeId,
        originalUrl: data.originalUrl,
        normalizedUrl: data.normalizedUrl,
        affiliateUrl: data.affiliateUrl,
        itemId: data.itemId,
        shopId: data.shopId,
        productName: data.productName,
        status: data.status,
        errorReason: data.errorReason,
        mode: data.mode,
        ipHash: data.ipHash,
        userAgent: data.userAgent,
        referrer: data.referrer,
        responseTimeMs: data.responseTimeMs
      }
    })
    .then(() => {
      recordConversion(data.status);
      return undefined;
    })
    .catch((error) => {
      publicConversionLogger.error(
        {
          eventType: 'public_conversion_persist_failed',
          requestId: data.requestId ?? null,
          conversionId: data.id,
          companySlug: data.companySlug ?? null,
          employeeSlug: data.employeeSlug ?? null,
          status: data.status,
          responseTimeMs: data.responseTimeMs,
          errorReason: normalizeErrorReason(error),
          err: error instanceof Error ? error : undefined
        },
        `${PUBLIC_CONVERT_LOG_PREFIX} public conversion persist failed`
      );
    });

  if (awaitPersistence) {
    return write;
  }
};

const toSuccessResult = ({
  conversionId,
  companySlug,
  employeeSlug,
  originalUrl,
  cacheHit,
  responseTimeMs,
  cached
}: {
  conversionId: string;
  companySlug: string;
  employeeSlug: string;
  originalUrl: string;
  cacheHit: boolean;
  responseTimeMs: number;
  cached: ConversionCacheValue;
}): ConversionResult => ({
  conversionId,
  status: 'SUCCESS',
  affiliateUrl: cached.affiliateUrl,
  originalUrl,
  normalizedUrl: cached.normalizedUrl,
  itemId: cached.itemId,
  shopId: cached.shopId,
  productName: cached.productName,
  companySlug,
  employeeSlug,
  mode: cached.mode,
  cacheHit,
  responseTimeMs
});

const buildConversionCacheKey = ({
  companyId,
  platformId,
  employeeSlug,
  mode,
  normalizedUrl
}: {
  companyId: number;
  platformId: number;
  employeeSlug: string;
  mode: ConversionMode;
  normalizedUrl: string;
}): string =>
  `public-conversion:${companyId}:${platformId}:${mode}:${employeeSlug}:${normalizedUrl}`;

const normalizeSlug = (value: string): string => slugifyPublicSlug(value);
const normalizeOptionalSlug = (value: string | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  return slugifyPublicSlug(value);
};

const sanitizeMetadataString = (value: string, maxLength: number): string =>
  value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);

const extractProductName = (analysis: ShopeeUrlAnalysis): string | undefined => {
  const normalizedUrl = analysis.normalizedUrl ?? analysis.originalUrl;

  try {
    const pathname = decodeURIComponent(new URL(normalizedUrl).pathname);
    const slugSegment = pathname
      .split('/')
      .filter(Boolean)
      .find((segment) => segment.includes('-i.'));

    if (!slugSegment) {
      return undefined;
    }

    const [rawName] = slugSegment.split('-i.');
    const name = rawName.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

    return name ? sanitizeMetadataString(name, 255) : undefined;
  } catch {
    return undefined;
  }
};

const sanitizeOptionalMetadataString = (
  value: string | undefined,
  maxLength: number
): string | undefined => {
  if (!value?.trim()) {
    return undefined;
  }

  return sanitizeMetadataString(value.trim(), maxLength);
};

const normalizeErrorReason = (error: unknown): string => {
  if (error instanceof HttpError) {
    return error.errorCode ?? error.message;
  }

  if (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'PUBLIC_CONVERSION_ERROR';
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const logPublicConversion = (
  event: string,
  requestId: string | undefined,
  result: ConversionResult,
  metadata: Record<string, unknown> = {}
): void => {
  publicConversionLogger.info(
    {
      eventType: `public_conversion_${event}`,
      requestId: requestId ?? null,
      conversionId: result.conversionId,
      companySlug: result.companySlug,
      employeeSlug: result.employeeSlug,
      status: result.status,
      mode: result.mode,
      cacheHit: result.cacheHit,
      responseTimeMs: result.responseTimeMs,
      ...metadata
    },
    `${PUBLIC_CONVERT_LOG_PREFIX} public conversion event`
  );
};

export { convertPublicUrl, recordBotDetectedConversion };
export type {
  ConversionResult,
  ConvertPublicUrlInput,
  PublicConversionOptions,
  RecordBotDetectedConversionInput
};
