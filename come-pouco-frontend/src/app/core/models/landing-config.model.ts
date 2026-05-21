export interface LandingConfig {
  id: number;
  companyId: number;
  bannerText: string;
  bannerEmoji: string;
  heroTitle: string;
  heroSubtitle: string;
  howItWorksSteps: string[];
  primaryColor: string;
  logoUrl: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface LandingCompany {
  id: number;
  name: string;
  publicSlug: string | null;
  fallbackAffiliateUrl: string | null;
}

export interface LandingConfigResponse {
  company: LandingCompany;
  landingConfig: LandingConfig;
}

export interface UpdateLandingConfigPayload {
  bannerText?: string;
  bannerEmoji?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  howItWorksSteps?: string[];
  primaryColor?: string;
  logoUrl?: string | null;
  isActive?: boolean;
}
