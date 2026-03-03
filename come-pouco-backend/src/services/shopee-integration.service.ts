import crypto from 'node:crypto';

import env from '../config/env';
import HttpError from '../utils/httpError';
import { postGraphql } from './shopee-affiliate-client.service';

interface ShopeeGenerateShortLinksInput {
  appId: string;
  secret: string;
  apiUrl: string;
  originUrls: string[];
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

const generateShopeeShortLinks = async ({
  appId,
  secret,
  apiUrl,
  originUrls,
  subId1,
  forceMock
}: ShopeeGenerateShortLinksInput): Promise<ShopeeShortLinkResult[]> => {
  if (forceMock || env.shopeeMock) {
    const now = Date.now().toString();
    return originUrls.map((originUrl) => {
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

  return results;
};

export { generateShopeeShortLinks };
export type { ShopeeGenerateShortLinksInput, ShopeeShortLinkResult };
