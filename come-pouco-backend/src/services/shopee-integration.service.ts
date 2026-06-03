import crypto from 'node:crypto';

import env from '../config/env';
import prisma from '../config/prisma';
import { recordShopeeApiCall } from '../lib/metrics';
import HttpError from '../utils/httpError';
import { postGraphql } from './shopee-affiliate-client.service';
import { expandShortlink, ShortlinkExpansionError } from './shortlink-expander.service';
import { parseShopeeUrl } from './shopee-url-parser.service';

interface ShopeeGenerateShortLinksInput {
  appId: string;
  secret: string;
  apiUrl: string;
  originUrls: string[];
  companyId?: number;
  userId?: number;
  platformId: number;
  subId1?: string;
  subIds?: string[];
  forceMock?: boolean;
}

interface GenerateShortLinkGraphqlData {
  generateShortLink?: {
    shortLink?: string;
    shortUrl?: string;
    short_link?: string;
    originUrl?: string;
    origin_url?: string;
  };
}

interface ShopeeShortLinkResult {
  originUrl: string;
  success: boolean;
  shortLink?: string;
  error?: string;
}

const GENERATE_SHORT_LINK_MUTATION = `
  mutation GenerateShortLink($originUrl: String!, $subIds: [String!]) {
    generateShortLink(originUrl: $originUrl, subIds: $subIds) {
      shortLink
      originUrl
    }
  }
`;

const normalizeShortLink = (
  input: GenerateShortLinkGraphqlData | undefined,
  _fallbackOriginUrl: string
): string => {
  const payload = input?.generateShortLink;
  const shortLink = payload?.shortLink || payload?.shortUrl || payload?.short_link;

  if (!shortLink || typeof shortLink !== 'string') {
    throw new HttpError(502, 'Resposta invalida ao gerar shortlink na Shopee.');
  }

  return shortLink;
};

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Falha ao gerar shortlink.';
};

const registerApiRequestLogs = async ({
  companyId,
  userId,
  platformId,
  mode,
  endpoint,
  results
}: {
  companyId?: number;
  userId?: number;
  platformId: number;
  mode: 'MOCK' | 'REAL';
  endpoint: string;
  results: ShopeeShortLinkResult[];
}): Promise<void> => {
  if (!companyId || !userId || !results.length) {
    return;
  }

  await prisma.apiRequestLog.createMany({
    data: results.map((result) => ({
      companyId,
      userId,
      platformId,
      mode,
      endpoint,
      success: result.success
    }))
  });
};

const generateShopeeShortLinks = async ({
  appId,
  secret,
  apiUrl,
  originUrls,
  companyId,
  userId,
  platformId,
  subId1,
  subIds,
  forceMock
}: ShopeeGenerateShortLinksInput): Promise<ShopeeShortLinkResult[]> => {
  const normalizedSubIds =
    subIds
      ?.map((subId) => subId.trim())
      .filter(Boolean)
      .slice(0, 3) ?? (subId1?.trim() ? [subId1.trim()] : undefined);

  if (forceMock || env.shopeeMock) {
    const now = Date.now().toString();
    const results = originUrls.map((originUrl) => {
      const startedAt = Date.now();
      const forcedFailure = shouldForceMockFailure(originUrl);

      if (forcedFailure) {
        recordShopeeApiCall({ mode: 'MOCK', success: false, durationMs: Date.now() - startedAt });

        return {
          originUrl,
          success: false,
          error: 'SHOPEE_MOCK_FORCED_FAILURE'
        };
      }

      const hash = crypto
        .createHash('sha256')
        .update(`${originUrl}|${normalizedSubIds?.join('|') || ''}|${now}`)
        .digest('hex')
        .slice(0, 12);

      recordShopeeApiCall({ mode: 'MOCK', success: true, durationMs: Date.now() - startedAt });

      return {
        originUrl,
        success: true,
        shortLink: `https://br.shp.ee/${hash}`
      };
    });

    await registerApiRequestLogs({
      companyId,
      userId,
      platformId,
      mode: 'MOCK',
      endpoint: apiUrl,
      results
    });

    return results;
  }

  const results = await Promise.all(
    originUrls.map(async (originUrl) => {
      const startedAt = Date.now();
      try {
        const resolvedOrigin = await resolveOriginUrlForGeneration(originUrl);

        if (resolvedOrigin.error) {
          recordShopeeApiCall({
            mode: 'REAL',
            success: false,
            durationMs: Date.now() - startedAt
          });

          return {
            originUrl,
            success: false,
            error: resolvedOrigin.error
          } satisfies ShopeeShortLinkResult;
        }

        const response = await postGraphql<GenerateShortLinkGraphqlData>({
          appId,
          secret,
          apiUrl,
          body: {
            query: GENERATE_SHORT_LINK_MUTATION,
            variables: {
              originUrl: resolvedOrigin.url,
              subIds: normalizedSubIds
            }
          }
        });

        const shortLink = normalizeShortLink(response.data, originUrl);
        recordShopeeApiCall({ mode: 'REAL', success: true, durationMs: Date.now() - startedAt });

        return {
          originUrl,
          success: true,
          shortLink
        } satisfies ShopeeShortLinkResult;
      } catch (error) {
        recordShopeeApiCall({ mode: 'REAL', success: false, durationMs: Date.now() - startedAt });
        return {
          originUrl,
          success: false,
          error: normalizeErrorMessage(error)
        } satisfies ShopeeShortLinkResult;
      }
    })
  );

  await registerApiRequestLogs({
    companyId,
    userId,
    platformId,
    mode: 'REAL',
    endpoint: apiUrl,
    results
  });

  return results;
};

const shouldForceMockFailure = (originUrl: string): boolean =>
  Boolean(env.shopeeMockFailurePattern && originUrl.includes(env.shopeeMockFailurePattern));

const resolveOriginUrlForGeneration = async (
  originUrl: string
): Promise<{ url: string; error?: string }> => {
  const analysis = parseShopeeUrl(originUrl);

  if (!analysis.valid) {
    return { url: originUrl.trim() };
  }

  if (analysis.kind !== 'short') {
    return { url: analysis.normalizedUrl ?? originUrl.trim() };
  }

  try {
    const expansion = await expandShortlink(analysis.normalizedUrl ?? originUrl);
    const expandedAnalysis = parseShopeeUrl(expansion.finalUrl);

    if (!expandedAnalysis.valid) {
      return {
        url: expansion.finalUrl,
        error: 'Shortlink expandiu para URL invalida.'
      };
    }

    return { url: expandedAnalysis.normalizedUrl ?? expansion.finalUrl };
  } catch (error) {
    const message =
      error instanceof ShortlinkExpansionError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Falha ao expandir shortlink Shopee.';

    return { url: originUrl, error: message };
  }
};

export { generateShopeeShortLinks, resolveOriginUrlForGeneration };
export type { ShopeeGenerateShortLinksInput, ShopeeShortLinkResult };
