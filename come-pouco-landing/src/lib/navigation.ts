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
    href: 'https://instagram.com/comepouco',
    external: true
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/company/come-pouco',
    external: true
  },
  {
    label: 'GitHub',
    href: 'https://github.com/come-pouco',
    external: true
  }
];

export function getAppUrl(path = '/login'): string {
  const base = import.meta.env.PUBLIC_APP_URL ?? 'https://app.come-pouco.com.br';
  return `${base}${path}`;
}
