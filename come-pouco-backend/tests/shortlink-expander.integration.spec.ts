import { describe, expect, it } from 'vitest';

import { expandShortlink } from '../src/services/shortlink-expander.service';

const describeRealShortlink =
  process.env.RUN_REAL_SHOPEE_SHORTLINK_TESTS === 'true' ? describe : describe.skip;

describeRealShortlink('expandShortlink real Shopee URLs', () => {
  it('expands a real Shopee shortlink when explicitly enabled', async () => {
    const url = process.env.SHOPEE_REAL_SHORTLINK_URL;

    if (!url) {
      throw new Error('Set SHOPEE_REAL_SHORTLINK_URL to run this integration test.');
    }

    const result = await expandShortlink(url, {
      cache: null,
      requestId: 'manual-integration-test'
    });

    expect(result.finalUrl).toMatch(/^https?:\/\//);
    expect(result.hops).toBeGreaterThanOrEqual(0);
  });
});
