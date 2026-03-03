export interface AffiliateLink {
  id: number;
  originalLink: string;
  subId1?: string | null;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  companyId?: number | null;
  createdByUserId?: number | null;
  createdByUser?: {
    id: number;
    fullName: string;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAffiliateLinkPayload {
  originalLinks: string[];
  subId1: string | null;
  affiliateLink: string;
}

export interface CreateAffiliateLinksFromGeneratedPayload {
  generatedLinks: Array<{
    originUrl: string;
    shortLink: string;
  }>;
  subId1: string | null;
}

export interface GenerateShopeeShortLinksPayload {
  platformId?: number;
  originUrls: string[];
  subId1?: string;
}

export interface ShopeeShortLinkResult {
  originUrl: string;
  success: boolean;
  shortLink?: string;
  error?: string;
}

export interface UpdateAffiliateLinkPayload {
  originalLink?: string;
  subId1?: string | null;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}
