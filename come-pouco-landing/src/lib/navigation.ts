export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

export const primaryNav: NavItem[] = [
  { label: 'Recursos', href: '/#features' },
  { label: 'Como funciona', href: '/#how-it-works' },
  { label: 'Preços', href: '/#pricing' },
  { label: 'Alli', href: '/#alli' },
  { label: 'FAQ', href: '/#faq' }
];

export const footerSections: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: 'Produto',
    items: [
      { label: 'Recursos', href: '/#features' },
      { label: 'Preços', href: '/#pricing' },
      { label: 'Módulo Alli', href: '/#alli' },
      { label: 'Segurança', href: '/#security' }
    ]
  },
  {
    heading: 'Empresa',
    items: [
      { label: 'Sobre', href: '/sobre' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contato', href: '/#lead' }
    ]
  },
  {
    heading: 'Legal',
    items: [
      { label: 'Privacidade', href: '/privacidade' },
      { label: 'Termos', href: '/termos' },
      { label: 'LGPD', href: '/lgpd' }
    ]
  }
];

export const socialLinks: NavItem[] = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/auralinks',
    external: true
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/auralinks',
    external: true
  },
  {
    label: 'GitHub',
    href: 'https://github.com/auralinks',
    external: true
  }
];

const DEFAULT_APP_ORIGIN = 'https://app.auralinks.com.br';

/** Base URL da app autenticada (CTAs Entrar / Começar grátis). */
export function getAppOrigin(): string {
  const configured = import.meta.env.PUBLIC_APP_URL?.trim();
  const base = configured || DEFAULT_APP_ORIGIN;
  return base.replace(/\/+$/, '');
}

export function getAppUrl(path = '/login'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppOrigin()}${normalizedPath}`;
}
