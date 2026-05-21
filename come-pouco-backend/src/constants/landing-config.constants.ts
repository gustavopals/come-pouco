const DEFAULT_HOW_IT_WORKS_STEPS = [
  'Cole o link Shopee',
  'Aplicamos o link da loja',
  'Voce compra normalmente'
];

const createDefaultLandingConfigData = () => ({
  bannerText: 'Ofertas Shopee em segundos',
  bannerEmoji: '🛍️',
  heroTitle: 'Economize nas compras da Shopee',
  heroSubtitle: 'Cole o link do produto e siga para a Shopee com o rastreamento aplicado.',
  howItWorksSteps: [...DEFAULT_HOW_IT_WORKS_STEPS],
  primaryColor: '#10b981',
  isActive: false
});

export { DEFAULT_HOW_IT_WORKS_STEPS, createDefaultLandingConfigData };
