import { Prisma } from '@prisma/client';

import { uniqueSuffix } from './factory-utils';

export const buildLandingConfig = (
  overrides: Partial<Prisma.LandingConfigUncheckedCreateInput> = {}
): Prisma.LandingConfigUncheckedCreateInput => ({
  companyId: 1,
  bannerText: 'Ofertas Shopee em segundos',
  bannerEmoji: 'bag',
  heroTitle: `Economize com ${uniqueSuffix(6)}`,
  heroSubtitle: 'Cole o link do produto e siga para a Shopee com o rastreamento aplicado.',
  howItWorksSteps: ['Cole o link Shopee', 'Aplicamos o link da loja', 'Voce compra normalmente'],
  primaryColor: '#10b981',
  logoUrl: null,
  isActive: true,
  ...overrides
});
