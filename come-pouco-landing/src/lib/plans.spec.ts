import { describe, expect, it } from 'vitest';
import { comparisonRows, plans, yearlyDiscountPct } from './plans';

describe('landing plans', () => {
  it('keeps the public pricing structure coherent', () => {
    expect(yearlyDiscountPct).toBe(20);
    expect(plans.map((plan) => plan.id)).toEqual(['free', 'pro', 'enterprise']);
    expect(plans.find((plan) => plan.id === 'pro')).toMatchObject({
      priceMonthly: 79,
      priceYearly: 758,
      highlight: true
    });
  });

  it('keeps enterprise as a sales-assisted plan', () => {
    const enterprise = plans.find((plan) => plan.id === 'enterprise');

    expect(enterprise?.priceMonthly).toBeNull();
    expect(enterprise?.ctaHref).toBe('#lead');
    expect(enterprise?.features).toContain('SLA dedicado');
  });

  it('exposes comparison rows for the three plans', () => {
    expect(comparisonRows.length).toBeGreaterThan(8);
    expect(
      comparisonRows.every((row) => 'free' in row && 'pro' in row && 'enterprise' in row)
    ).toBe(true);
  });
});
