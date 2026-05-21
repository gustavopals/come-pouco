import { Prisma } from '@prisma/client';

import { truncate, uniqueSuffix } from './factory-utils';

export const buildAffiliateLink = (
  overrides: Partial<Prisma.AffiliateLinkUncheckedCreateInput> = {}
): Prisma.AffiliateLinkUncheckedCreateInput => {
  const shopId = uniqueSuffix(6);
  const itemId = uniqueSuffix(8);

  return {
    originalLink: `https://shopee.com.br/product/${shopId}/${itemId}`,
    subId1: `sub-${uniqueSuffix(8)}`,
    productImage: 'https://example.test/product.jpg',
    catchyPhrase: truncate(`Oferta ${uniqueSuffix(12)}`, 255),
    affiliateLink: `https://s.shopee.com.br/${uniqueSuffix(16)}`,
    ...overrides
  };
};
