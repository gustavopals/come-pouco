export interface Company {
  id: number;
  name: string;
  shopeeMode: 'TEST' | 'PROD';
  shopeePlatformId: number | null;
  shopeePlatformTestId: number | null;
  shopeePlatformProdId: number | null;
  shopeePlatform: {
    id: number;
    name: string;
    type: 'SHOPEE';
    isActive: boolean;
  } | null;
  shopeePlatformTest: {
    id: number;
    name: string;
    type: 'SHOPEE';
    isActive: boolean;
  } | null;
  shopeePlatformProd: {
    id: number;
    name: string;
    type: 'SHOPEE';
    isActive: boolean;
  } | null;
  activeShopeePlatformId: number | null;
  activeShopeePlatformSource: 'TEST' | 'PROD' | 'LEGACY' | null;
  isShopeeConfiguredForMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyPayload {
  name: string;
  shopeePlatformId?: number | null;
  shopeePlatformTestId?: number | null;
  shopeePlatformProdId?: number | null;
  shopeeMode?: 'TEST' | 'PROD';
}

export interface UpdateCompanyPayload {
  name?: string;
  shopeePlatformId?: number | null;
  shopeePlatformTestId?: number | null;
  shopeePlatformProdId?: number | null;
  shopeeMode?: 'TEST' | 'PROD';
}
