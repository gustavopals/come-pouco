import { describe, expect, it } from 'vitest';
import { footerSections, getAppUrl, primaryNav, socialLinks } from './navigation';

describe('landing navigation', () => {
  it('keeps primary navigation anchored to first-page sections', () => {
    expect(primaryNav.map((item) => item.href)).toEqual([
      '/#features',
      '/#how-it-works',
      '/#pricing',
      '/#alli',
      '/#faq'
    ]);
  });

  it('groups footer links by product, company, and legal sections', () => {
    expect(footerSections.map((section) => section.heading)).toEqual([
      'Produto',
      'Empresa',
      'Legal'
    ]);
    expect(
      footerSections.flatMap((section) => section.items).some((item) => item.href === '/lgpd')
    ).toBe(true);
  });

  it('marks external social links explicitly', () => {
    expect(socialLinks).toHaveLength(3);
    expect(socialLinks.every((link) => link.external)).toBe(true);
  });

  it('builds app URLs from the configured public app base', () => {
    expect(getAppUrl('/register')).toBe('https://app.come-pouco.com.br/register');
  });
});
