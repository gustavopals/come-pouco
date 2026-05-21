import { Prisma, ShopeeMode } from '@prisma/client';

import { truncate, uniqueSuffix } from './factory-utils';

export const buildCompany = (
  overrides: Partial<Prisma.CompanyUncheckedCreateInput> = {}
): Prisma.CompanyUncheckedCreateInput => ({
  name: truncate(`Company ${uniqueSuffix(12)}`, 160),
  historyRetentionDays: 30,
  shopeeMode: ShopeeMode.TEST,
  publicSlug: `company-${uniqueSuffix(12)}`,
  fallbackAffiliateUrl: 'https://shopee.com.br/fallback-affiliate',
  ...overrides
});
