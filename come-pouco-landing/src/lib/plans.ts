export interface Plan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  priceLabel?: string;
  highlight?: boolean;
  ctaLabel: string;
  ctaHref: string;
  ctaEvent: string;
  features: string[];
}

const APP = import.meta.env.PUBLIC_APP_URL ?? 'https://app.auralinks.com.br';

export const yearlyDiscountPct = 20;

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Pra começar e validar',
    priceMonthly: 0,
    priceYearly: 0,
    priceLabel: 'R$ 0',
    ctaLabel: 'Começar grátis',
    ctaHref: `${APP}/register?plan=free`,
    ctaEvent: 'cta_click_pricing_free',
    features: [
      'Grátis por 1 mês',
      '1 empresa',
      '1 usuário',
      'Até 100 links/mês',
      'Módulo Alli básico',
      'Suporte por email'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pra times sérios',
    priceMonthly: 79,
    priceYearly: Math.round(79 * 12 * (1 - 20 / 100)),
    highlight: true,
    ctaLabel: 'Assinar Pro',
    ctaHref: `${APP}/register?plan=pro`,
    ctaEvent: 'cta_click_pricing_pro',
    features: [
      'Até 5 usuários',
      'Links ilimitados',
      'Alli com customização total',
      'Audit log completo',
      'Suporte prioritário'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Pra operações grandes',
    priceMonthly: null,
    priceYearly: null,
    priceLabel: 'Fale conosco',
    ctaLabel: 'Falar com vendas',
    ctaHref: '#lead',
    ctaEvent: 'cta_click_pricing_enterprise',
    features: [
      'Usuários ilimitados',
      'SLA dedicado',
      'Onboarding com nosso time',
      'API customizada',
      'White-label (em breve)'
    ]
  }
];

export interface ComparisonRow {
  category: string;
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

export const comparisonRows: ComparisonRow[] = [
  { category: 'Uso', feature: 'Empresas', free: '1', pro: 'até 3', enterprise: 'Ilimitado' },
  {
    category: 'Uso',
    feature: 'Usuários por empresa',
    free: '1',
    pro: 'até 5',
    enterprise: 'Ilimitado'
  },
  {
    category: 'Uso',
    feature: 'Links por mês',
    free: '100',
    pro: 'Ilimitado',
    enterprise: 'Ilimitado'
  },
  {
    category: 'Recursos',
    feature: 'Módulo Alli',
    free: 'Básico',
    pro: 'Customização total',
    enterprise: 'White-label'
  },
  {
    category: 'Recursos',
    feature: 'Modo TEST + PROD Shopee',
    free: true,
    pro: true,
    enterprise: true
  },
  {
    category: 'Recursos',
    feature: 'Dashboard de métricas',
    free: true,
    pro: true,
    enterprise: true
  },
  { category: 'Recursos', feature: 'Audit log', free: false, pro: true, enterprise: true },
  { category: 'Recursos', feature: '2FA TOTP', free: true, pro: true, enterprise: true },
  { category: 'Recursos', feature: 'Trusted devices', free: true, pro: true, enterprise: true },
  {
    category: 'Recursos',
    feature: 'API REST',
    free: false,
    pro: 'Standard',
    enterprise: 'Customizada'
  },
  {
    category: 'Suporte',
    feature: 'Canal',
    free: 'Email',
    pro: 'Email prioritário',
    enterprise: 'Email + Slack'
  },
  { category: 'Suporte', feature: 'SLA', free: false, pro: false, enterprise: '99.9% uptime' },
  { category: 'Suporte', feature: 'Onboarding dedicado', free: false, pro: false, enterprise: true }
];
