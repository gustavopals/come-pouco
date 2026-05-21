import { Prisma, PurchasePlatformType } from '@prisma/client';

import { uniqueSuffix } from './factory-utils';

export const buildPurchasePlatform = (
  overrides: Partial<Prisma.PurchasePlatformUncheckedCreateInput> = {}
): Prisma.PurchasePlatformUncheckedCreateInput => ({
  name: `Shopee Test ${uniqueSuffix(8)}`,
  description: 'Shopee platform for automated tests',
  type: PurchasePlatformType.SHOPEE,
  appId: `app-${uniqueSuffix(10)}`,
  secret: `secret-${uniqueSuffix(24)}`,
  apiUrl: 'https://open-api.affiliate.shopee.com.br/graphql',
  isActive: true,
  mockMode: true,
  apiLink: 'https://open-api.affiliate.shopee.com.br/graphql',
  accessKey: `access-${uniqueSuffix(16)}`,
  ...overrides
});
