import type { ShopeeUrlAnalysis, ShopeeUrlInvalidReason, ShopeeUrlKind } from '../types/shopee-url';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const SHORTLINK_HOSTS = new Set(['shope.ee', 's.shopee.com.br', 'br.shp.ee', 'shp.ee']);

const AFFILIATE_QUERY_PARAMS = new Set([
  'af_click_lookback',
  'af_reengagement_window',
  'af_siteid',
  'af_sub_siteid',
  'affiliate_id',
  'click_id',
  'deep_and_deferred',
  'is_from_login',
  'pid',
  'sp_atk',
  'sub_id',
  'sub_id1',
  'sub_id2',
  'sub_id3',
  'sub_id_1',
  'sub_id_2',
  'sub_id_3',
  'subid',
  'subid1',
  'subid2',
  'subid3',
  'uls_trackid',
  'xptdk'
]);

const AFFILIATE_QUERY_PREFIXES = ['utm_', 'af_'];

// Matches Shopee's canonical product route: /product/{shopId}/{itemId}
const SHOPEE_PRODUCT_REGEX_CANONICAL = /^\/product\/(?<shopId>\d+)\/(?<itemId>\d+)\/?$/;

// Matches Shopee's common slug route: /product-name-i.{shopId}.{itemId}
const SHOPEE_PRODUCT_REGEX_SLUG_I = /^\/.+-i\.(?<shopId>\d+)\.(?<itemId>\d+)\/?$/;

// Shopee shortlinks use an opaque code after the host.
const SHOPEE_SHORTLINK_REGEX = /^\/[A-Za-z0-9_-]+\/?$/;

const parseShopeeUrl = (input: string): ShopeeUrlAnalysis => {
  const originalUrl = input.trim();

  if (!originalUrl) {
    return toInvalidAnalysis(originalUrl, 'EMPTY_INPUT');
  }

  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return toInvalidAnalysis(originalUrl, 'MALFORMED_URL');
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    return toInvalidAnalysis(originalUrl, 'UNSUPPORTED_PROTOCOL');
  }

  const host = parsed.hostname.toLowerCase();
  if (!isShopeeHost(host)) {
    return toInvalidAnalysis(originalUrl, 'NON_SHOPEE_DOMAIN');
  }

  const normalization = normalizeShopeeUrl(parsed);

  if (isShortlinkHost(host) && SHOPEE_SHORTLINK_REGEX.test(parsed.pathname)) {
    return toValidAnalysis({
      kind: 'short',
      originalUrl,
      host,
      ...normalization
    });
  }

  const productMatch = matchProductPath(parsed.pathname);
  if (productMatch) {
    return toValidAnalysis({
      kind: 'product',
      originalUrl,
      host,
      shopId: productMatch.shopId,
      itemId: productMatch.itemId,
      ...normalization
    });
  }

  return toValidAnalysis({
    kind: 'non-product',
    originalUrl,
    host,
    ...normalization
  });
};

const isShopeeHost = (host: string): boolean =>
  host === 'shope.ee' ||
  host === 'shopee.com.br' ||
  host.endsWith('.shopee.com.br') ||
  host === 'br.shp.ee' ||
  host === 'shp.ee' ||
  host.endsWith('.shp.ee');

const isShortlinkHost = (host: string): boolean =>
  SHORTLINK_HOSTS.has(host) || host.endsWith('.shp.ee');

const matchProductPath = (pathname: string): { shopId: string; itemId: string } | null => {
  const canonicalMatch = SHOPEE_PRODUCT_REGEX_CANONICAL.exec(pathname);
  if (canonicalMatch?.groups) {
    return {
      shopId: canonicalMatch.groups.shopId,
      itemId: canonicalMatch.groups.itemId
    };
  }

  const slugMatch = SHOPEE_PRODUCT_REGEX_SLUG_I.exec(pathname);
  if (slugMatch?.groups) {
    return {
      shopId: slugMatch.groups.shopId,
      itemId: slugMatch.groups.itemId
    };
  }

  return null;
};

const normalizeShopeeUrl = (
  parsed: URL
): Pick<ShopeeUrlAnalysis, 'normalizedUrl' | 'hasAffiliateParams' | 'removedAffiliateParams'> => {
  const normalized = new URL(parsed.href);
  normalized.hash = '';

  const removedParams = new Set<string>();
  normalized.searchParams.forEach((_value, key) => {
    if (isAffiliateQueryParam(key)) {
      removedParams.add(key);
    }
  });

  removedParams.forEach((key) => normalized.searchParams.delete(key));

  return {
    normalizedUrl: normalized.href,
    hasAffiliateParams: removedParams.size > 0,
    removedAffiliateParams: [...removedParams]
  };
};

const isAffiliateQueryParam = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();
  return (
    AFFILIATE_QUERY_PARAMS.has(normalizedKey) ||
    AFFILIATE_QUERY_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
  );
};

const toInvalidAnalysis = (
  originalUrl: string,
  reason: ShopeeUrlInvalidReason
): ShopeeUrlAnalysis => ({
  valid: false,
  kind: 'invalid',
  originalUrl,
  hasAffiliateParams: false,
  removedAffiliateParams: [],
  reason
});

const toValidAnalysis = (
  input: Pick<
    ShopeeUrlAnalysis,
    | 'kind'
    | 'originalUrl'
    | 'host'
    | 'normalizedUrl'
    | 'hasAffiliateParams'
    | 'removedAffiliateParams'
  > &
    Partial<Pick<ShopeeUrlAnalysis, 'shopId' | 'itemId'>>
): ShopeeUrlAnalysis => ({
  valid: true,
  ...input
});

export {
  SHORTLINK_HOSTS,
  SHOPEE_PRODUCT_REGEX_CANONICAL,
  SHOPEE_PRODUCT_REGEX_SLUG_I,
  SHOPEE_SHORTLINK_REGEX,
  isShopeeHost,
  isShortlinkHost,
  parseShopeeUrl
};
export type { ShopeeUrlAnalysis, ShopeeUrlInvalidReason, ShopeeUrlKind };
