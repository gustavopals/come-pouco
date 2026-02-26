export interface AffiliateLink {
  id: number;
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAffiliateLinkPayload {
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
}

export interface UpdateAffiliateLinkPayload {
  originalLink?: string;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}
