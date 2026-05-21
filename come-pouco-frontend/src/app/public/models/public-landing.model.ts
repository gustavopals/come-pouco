export interface PublicLandingConfig {
  bannerText: string;
  bannerEmoji: string;
  heroTitle: string;
  heroSubtitle: string;
  howItWorksSteps: string[];
  primaryColor: string;
  logoUrl: string | null;
  isActive: boolean;
}

export interface PublicLandingCompany {
  name: string;
  publicSlug: string;
}

export interface PublicLandingResponse {
  company: PublicLandingCompany;
  landingConfig: PublicLandingConfig;
}

export interface PublicConvertPayload {
  url: string;
  companySlug: string;
  employeeSlug?: string;
  honeypot?: string;
  website?: string;
  email_alt?: string;
}

export interface PublicConvertResponse {
  status: 'success' | 'fallback' | 'error';
  affiliateUrl?: string;
  conversionId?: string;
  errorCode?: string;
}
