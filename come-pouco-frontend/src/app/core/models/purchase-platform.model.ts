import { PaginationMeta } from './pagination.model';

export interface PurchasePlatform {
  id: number;
  name: string;
  description: string;
  type: 'SHOPEE';
  appId: string;
  secretConfigured: boolean;
  isActive: boolean;
  mockMode: boolean;
  apiUrl: string;
  apiLink: string;
  accessKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformCompanyLink {
  companyId: number;
  companyName: string;
  isDefaultForCompany: boolean;
  createdAt: string;
}

export interface CreatePurchasePlatformPayload {
  name: string;
  description: string;
  type: 'SHOPEE';
  appId: string;
  secret: string;
  isActive: boolean;
  mockMode: boolean;
  apiUrl: string;
  apiLink: string;
  accessKey: string;
}

export interface UpdatePurchasePlatformPayload {
  name?: string;
  description?: string;
  type?: 'SHOPEE';
  appId?: string;
  secret?: string;
  isActive?: boolean;
  mockMode?: boolean;
  apiUrl?: string;
  apiLink?: string;
  accessKey?: string;
}

export interface UpdatePlatformCompaniesPayload {
  companyIds: number[];
  defaultCompanyIds: number[];
}

export type ApiUsageMode = 'MOCK' | 'REAL';

export interface ApiUsageSummary {
  totalMock: number;
  totalReal: number;
  totalGeral: number;
  logs?: ApiUsageLog[];
  data?: ApiUsageLog[];
  items?: ApiUsageLog[];
  meta?: PaginationMeta;
}

export interface ApiUsageLog {
  id: string;
  companyId: number;
  userId: number;
  platformId: number;
  mode: ApiUsageMode;
  endpoint: string | null;
  success: boolean;
  createdAt: string;
}
