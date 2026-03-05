import crypto from 'node:crypto';

import env from '../config/env';
import prisma from '../config/prisma';
import HttpError from '../utils/httpError';
import { postGraphql } from './shopee-affiliate-client.service';

interface ShopeeGenerateShortLinksInput {
  appId: string;
  secret: string;
  apiUrl: string;
  originUrls: string[];
  companyId?: number;
  userId: number;
  platformId: number;
  subId1?: string;
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

const normalizeShortLink = (input: GenerateShortLinkGraphqlData | undefined, fallbackOriginUrl: string): string => {
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
  userId: number;
  platformId: number;
  mode: 'MOCK' | 'REAL';
  endpoint: string;
  results: ShopeeShortLinkResult[];
}): Promise<void> => {
  if (!companyId || !results.length) {
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
  forceMock
}: ShopeeGenerateShortLinksInput): Promise<ShopeeShortLinkResult[]> => {
  if (forceMock || env.shopeeMock) {
    const now = Date.now().toString();
    const results = originUrls.map((originUrl) => {
      const hash = crypto
        .createHash('sha256')
        .update(`${originUrl}|${subId1 || ''}|${now}`)
        .digest('hex')
        .slice(0, 12);

      return {
        originUrl,
        success: true,
        shortLink: `https://shopee.mock/s/${hash}`
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

  const normalizedSubIds = subId1?.trim() ? [subId1.trim()] : undefined;

  const results = await Promise.all(
    originUrls.map(async (originUrl) => {
      try {
        const response = await postGraphql<GenerateShortLinkGraphqlData>({
          appId,
          secret,
          apiUrl,
          body: {
            query: GENERATE_SHORT_LINK_MUTATION,
            variables: {
              originUrl,
              subIds: normalizedSubIds
            }
          }
        });

        const shortLink = normalizeShortLink(response.data, originUrl);

        return {
          originUrl,
          success: true,
          shortLink
        } satisfies ShopeeShortLinkResult;
      } catch (error) {
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

export { generateShopeeShortLinks };
export type { ShopeeGenerateShortLinksInput, ShopeeShortLinkResult };
