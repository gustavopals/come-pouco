type ShopeeUrlKind = 'product' | 'short' | 'non-product' | 'invalid';

type ShopeeUrlInvalidReason =
  | 'EMPTY_INPUT'
  | 'MALFORMED_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'NON_SHOPEE_DOMAIN';

interface ShopeeUrlAnalysis {
  valid: boolean;
  kind: ShopeeUrlKind;
  originalUrl: string;
  normalizedUrl?: string;
  host?: string;
  shopId?: string;
  itemId?: string;
  hasAffiliateParams: boolean;
  removedAffiliateParams: string[];
  reason?: ShopeeUrlInvalidReason;
}

export type { ShopeeUrlAnalysis, ShopeeUrlInvalidReason, ShopeeUrlKind };
