import { describe, expect, it } from 'vitest';
import { alliBenefits, coreFeatures, howItWorksSteps, securityBadges } from './features';
import { faq } from './faq';

describe('landing content models', () => {
  it('keeps the main feature set balanced and flags roadmap items', () => {
    expect(coreFeatures).toHaveLength(6);
    expect(coreFeatures.some((feature) => feature.upcoming)).toBe(true);
    expect(
      coreFeatures.every((feature) => feature.icon && feature.title && feature.description)
    ).toBe(true);
  });

  it('keeps security badges focused on trust signals', () => {
    expect(securityBadges.map((badge) => badge.title)).toContain('Criptografia AES-256');
    expect(securityBadges.map((badge) => badge.title)).toContain('Conformidade LGPD');
  });

  it('keeps the onboarding steps numbered and ordered', () => {
    expect(howItWorksSteps.map((step) => step.number)).toEqual(['01', '02', '03', '04']);
  });

  it('keeps Alli benefits and FAQ content available for page rendering', () => {
    expect(alliBenefits).toHaveLength(3);
    expect(faq.length).toBeGreaterThanOrEqual(8);
    expect(faq.some((item) => item.q.includes('Shopee Afiliados'))).toBe(true);
  });
});
