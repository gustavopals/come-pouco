import env from '../config/env';
import { publicCache } from '../cache/public.cache';
import { logger } from '../lib/logger';
import type { Cache } from '../utils/cache';
import { parseShopeeUrl } from './shopee-url-parser.service';

const SHORTLINK_CACHE_TTL_SEC = 7 * 24 * 60 * 60;
const SHORTLINK_MAX_HOPS = 5;
const DEFAULT_MOCK_TARGET_URL = 'https://shopee.com.br/product/10001/20001';
const SHORTLINK_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HEAD_FALLBACK_STATUSES = new Set([400, 403, 404, 405, 501]);
const shortlinkLogger = logger.child({ scope: 'shortlink-expander' });

type ShortlinkErrorCode =
  | 'SHORTLINK_INVALID'
  | 'SHORTLINK_TIMEOUT'
  | 'SHORTLINK_LOOP'
  | 'SHORTLINK_UNREACHABLE';

interface ShortlinkExpansionResult {
  finalUrl: string;
  hops: number;
}

interface ShortlinkExpansionOptions {
  requestId?: string;
  fetchImpl?: typeof fetch;
  cache?: Cache | null;
  timeoutMs?: number;
  maxHops?: number;
  userAgent?: string;
}

class ShortlinkExpansionError extends Error {
  readonly code: ShortlinkErrorCode;

  constructor(code: ShortlinkErrorCode, message: string) {
    super(message);
    this.name = 'ShortlinkExpansionError';
    this.code = code;
  }
}

const expandShortlink = async (
  url: string,
  options: ShortlinkExpansionOptions = {}
): Promise<ShortlinkExpansionResult> => {
  const analysis = parseShopeeUrl(url);

  if (!analysis.valid || analysis.kind !== 'short' || !analysis.normalizedUrl) {
    throw new ShortlinkExpansionError('SHORTLINK_INVALID', 'URL curta Shopee invalida.');
  }

  const mockTargetUrl = getMockTargetUrl();
  if (mockTargetUrl) {
    logShortlinkEvent('mock_success', options.requestId, analysis.normalizedUrl, {
      finalUrl: sanitizeUrlForLog(mockTargetUrl),
      hops: 1
    });
    return {
      finalUrl: mockTargetUrl,
      hops: 1
    };
  }

  const cache = options.cache === undefined ? publicCache : options.cache;
  const cacheKey = `shortlink:${analysis.normalizedUrl}`;

  if (cache) {
    return cache.getOrSet(
      cacheKey,
      () => expandShortlinkUncached(analysis.normalizedUrl!, options),
      SHORTLINK_CACHE_TTL_SEC
    );
  }

  return expandShortlinkUncached(analysis.normalizedUrl, options);
};

const expandShortlinkUncached = async (
  startUrl: string,
  options: ShortlinkExpansionOptions
): Promise<ShortlinkExpansionResult> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? env.shortlinkTimeoutMs;
  const maxHops = options.maxHops ?? SHORTLINK_MAX_HOPS;
  const userAgent = options.userAgent ?? SHORTLINK_USER_AGENT;
  const signal = AbortSignal.timeout(timeoutMs);
  const visitedUrls = new Set<string>([startUrl]);
  let currentUrl = startUrl;
  let hops = 0;

  logShortlinkEvent('start', options.requestId, currentUrl, { timeoutMs, maxHops });

  try {
    while (true) {
      const response = await fetchHeaders(fetchImpl, currentUrl, signal, userAgent);

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new ShortlinkExpansionError(
            'SHORTLINK_UNREACHABLE',
            `Redirect sem Location em ${response.status}.`
          );
        }

        const nextUrl = new URL(location, currentUrl).href;
        hops += 1;

        if (hops > maxHops || visitedUrls.has(nextUrl)) {
          throw new ShortlinkExpansionError(
            'SHORTLINK_LOOP',
            'Loop ou excesso de redirects ao expandir shortlink.'
          );
        }

        visitedUrls.add(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      if (response.status >= 200 && response.status < 400) {
        logShortlinkEvent('success', options.requestId, currentUrl, {
          hops,
          status: response.status
        });
        return {
          finalUrl: currentUrl,
          hops
        };
      }

      throw new ShortlinkExpansionError(
        'SHORTLINK_UNREACHABLE',
        `Destino retornou HTTP ${response.status}.`
      );
    }
  } catch (error) {
    if (signal.aborted || isTimeoutError(error)) {
      logShortlinkEvent('timeout', options.requestId, currentUrl, { hops, timeoutMs });
      throw new ShortlinkExpansionError(
        'SHORTLINK_TIMEOUT',
        'Timeout ao expandir shortlink Shopee.'
      );
    }

    if (error instanceof ShortlinkExpansionError) {
      logShortlinkEvent('error', options.requestId, currentUrl, { hops, code: error.code });
      throw error;
    }

    logShortlinkEvent('error', options.requestId, currentUrl, {
      hops,
      code: 'SHORTLINK_UNREACHABLE'
    });
    throw new ShortlinkExpansionError(
      'SHORTLINK_UNREACHABLE',
      'Falha ao expandir shortlink Shopee.'
    );
  }
};

const fetchHeaders = async (
  fetchImpl: typeof fetch,
  url: string,
  signal: AbortSignal,
  userAgent: string
): Promise<Response> => {
  const headResponse = await fetchImpl(url, buildFetchInit('HEAD', signal, userAgent));

  if (!HEAD_FALLBACK_STATUSES.has(headResponse.status)) {
    return headResponse;
  }

  const getResponse = await fetchImpl(url, buildFetchInit('GET', signal, userAgent));

  try {
    await getResponse.body?.cancel();
  } catch {
    // Headers are enough for redirect expansion; body cancellation is best-effort.
  }

  return getResponse;
};

const buildFetchInit = (
  method: 'GET' | 'HEAD',
  signal: AbortSignal,
  userAgent: string
): RequestInit => ({
  method,
  redirect: 'manual',
  signal,
  headers: {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

const isTimeoutError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error.name === 'TimeoutError';
};

const logShortlinkEvent = (
  event: string,
  requestId: string | undefined,
  url: string,
  metadata: Record<string, unknown>
): void => {
  shortlinkLogger.info(
    {
      eventType: event,
      requestId: requestId ?? null,
      url: sanitizeUrlForLog(url),
      ...metadata
    },
    'shortlink expander event'
  );
};

const sanitizeUrlForLog = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return '[invalid-url]';
  }
};

const getMockTargetUrl = (): string | null => {
  if (!env.shopeeMock) {
    return null;
  }

  const targetUrl = env.shortlinkMockTargetUrl || DEFAULT_MOCK_TARGET_URL;
  const targetAnalysis = parseShopeeUrl(targetUrl);

  if (!targetAnalysis.valid || targetAnalysis.kind === 'short' || !targetAnalysis.normalizedUrl) {
    shortlinkLogger.warn(
      {
        eventType: 'shortlink_mock_target_invalid',
        targetUrl: sanitizeUrlForLog(targetUrl)
      },
      'shortlink mock target invalid'
    );
    return DEFAULT_MOCK_TARGET_URL;
  }

  return targetAnalysis.normalizedUrl;
};

export {
  DEFAULT_MOCK_TARGET_URL,
  SHORTLINK_CACHE_TTL_SEC,
  SHORTLINK_MAX_HOPS,
  SHORTLINK_USER_AGENT,
  ShortlinkExpansionError,
  expandShortlink
};
export type { ShortlinkErrorCode, ShortlinkExpansionOptions, ShortlinkExpansionResult };
