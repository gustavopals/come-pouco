import crypto from 'node:crypto';

import HttpError from '../utils/httpError';

interface ShopeeGraphqlRequest {
  appId: string;
  secret: string;
  apiUrl: string;
  body: Record<string, unknown>;
}

interface ShopeeGraphqlResponse<TData> {
  data?: TData;
  errors?: Array<{ message?: string }>;
}

const buildSignature = ({ appId, timestamp, payload, secret }: { appId: string; timestamp: string; payload: string; secret: string }): string => {
  return crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
};

const buildAuthorizationHeader = ({ appId, timestamp, signature }: { appId: string; timestamp: string; signature: string }): string => {
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
};

const postGraphql = async <TData>({ appId, secret, apiUrl, body }: ShopeeGraphqlRequest): Promise<ShopeeGraphqlResponse<TData>> => {
  const payload = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = buildSignature({ appId, timestamp, payload, secret });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthorizationHeader({ appId, timestamp, signature })
    },
    body: payload
  });

  if (!response.ok) {
    throw new HttpError(502, 'Falha ao comunicar com a Shopee Affiliate API.');
  }

  const data = (await response.json()) as ShopeeGraphqlResponse<TData>;

  if (Array.isArray(data.errors) && data.errors.length) {
    const message = data.errors[0]?.message || 'Erro retornado pela Shopee Affiliate API.';
    throw new HttpError(502, message);
  }

  return data;
};

export { postGraphql };
