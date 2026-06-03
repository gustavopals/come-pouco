import { describe, expect, it } from 'vitest';

import fixtures from './fixtures/shopee-urls.json';
import {
  SHOPEE_PRODUCT_REGEX_CANONICAL,
  SHOPEE_PRODUCT_REGEX_SLUG_I,
  SHOPEE_SHORTLINK_REGEX,
  parseShopeeUrl
} from '../src/services/shopee-url-parser.service';
import type { ShopeeUrlKind } from '../src/types/shopee-url';

interface ShopeeUrlFixture {
  description: string;
  input: string;
  kind: ShopeeUrlKind;
  shopId?: string;
  itemId?: string;
  hasAffiliateParams: boolean;
  removedAffiliateParams?: string[];
  normalizedUrl: string;
}

describe('parseShopeeUrl', () => {
  it('parses all collected Shopee URL fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);

    for (const fixture of fixtures as ShopeeUrlFixture[]) {
      const result = parseShopeeUrl(fixture.input);

      expect(result, fixture.description).toMatchObject({
        valid: true,
        kind: fixture.kind,
        hasAffiliateParams: fixture.hasAffiliateParams,
        normalizedUrl: fixture.normalizedUrl
      });

      if (fixture.shopId) {
        expect(result.shopId, fixture.description).toBe(fixture.shopId);
      }

      if (fixture.itemId) {
        expect(result.itemId, fixture.description).toBe(fixture.itemId);
      }

      expect(result.removedAffiliateParams, fixture.description).toEqual(
        fixture.removedAffiliateParams ?? []
      );
    }
  });

  it('rejects empty and malformed inputs', () => {
    expect(parseShopeeUrl('')).toMatchObject({
      valid: false,
      kind: 'invalid',
      originalUrl: '',
      reason: 'EMPTY_INPUT'
    });

    expect(parseShopeeUrl('   ')).toMatchObject({
      valid: false,
      kind: 'invalid',
      originalUrl: '',
      reason: 'EMPTY_INPUT'
    });

    expect(parseShopeeUrl('shopee.com.br/product/1/2')).toMatchObject({
      valid: false,
      kind: 'invalid',
      reason: 'MALFORMED_URL'
    });

    expect(parseShopeeUrl('not a url')).toMatchObject({
      valid: false,
      kind: 'invalid',
      reason: 'MALFORMED_URL'
    });
  });

  it('rejects unsupported protocols', () => {
    expect(parseShopeeUrl('ftp://shopee.com.br/product/1/2')).toMatchObject({
      valid: false,
      kind: 'invalid',
      reason: 'UNSUPPORTED_PROTOCOL'
    });

    expect(parseShopeeUrl('javascript:alert(1)')).toMatchObject({
      valid: false,
      kind: 'invalid',
      reason: 'UNSUPPORTED_PROTOCOL'
    });
  });

  it('rejects non-Shopee domains and lookalike hosts', () => {
    expect(parseShopeeUrl('https://example.com/product/1/2')).toMatchObject({
      valid: false,
      kind: 'invalid',
      reason: 'NON_SHOPEE_DOMAIN'
    });

    expect(parseShopeeUrl('https://shopee.com.br.evil.test/product/1/2')).toMatchObject({
      valid: false,
      kind: 'invalid',
      reason: 'NON_SHOPEE_DOMAIN'
    });
  });

  it('treats invalid shortlink paths as non-product Shopee URLs', () => {
    expect(parseShopeeUrl('https://shope.ee/')).toMatchObject({
      valid: true,
      kind: 'non-product',
      host: 'shope.ee'
    });

    expect(parseShopeeUrl('https://s.shopee.com.br/deep/path')).toMatchObject({
      valid: true,
      kind: 'non-product',
      host: 's.shopee.com.br'
    });

    expect(parseShopeeUrl('https://br.shp.ee/')).toMatchObject({
      valid: true,
      kind: 'non-product',
      host: 'br.shp.ee'
    });
  });

  it('recognizes br.shp.ee shortlinks', () => {
    expect(parseShopeeUrl('https://br.shp.ee/9ZkLmN4pQ')).toMatchObject({
      valid: true,
      kind: 'short',
      host: 'br.shp.ee',
      normalizedUrl: 'https://br.shp.ee/9ZkLmN4pQ'
    });
  });
});

describe('Shopee URL regexes', () => {
  it('documents supported product and shortlink path formats', () => {
    expect(SHOPEE_PRODUCT_REGEX_CANONICAL.test('/product/123/456')).toBe(true);
    expect(SHOPEE_PRODUCT_REGEX_CANONICAL.test('/product/123/456/')).toBe(true);
    expect(SHOPEE_PRODUCT_REGEX_CANONICAL.test('/product/abc/456')).toBe(false);

    expect(SHOPEE_PRODUCT_REGEX_SLUG_I.test('/fone-bluetooth-i.123.456')).toBe(true);
    expect(SHOPEE_PRODUCT_REGEX_SLUG_I.test('/fone-bluetooth-i.123.456/')).toBe(true);
    expect(SHOPEE_PRODUCT_REGEX_SLUG_I.test('/fone-bluetooth')).toBe(false);

    expect(SHOPEE_SHORTLINK_REGEX.test('/AbC123_-')).toBe(true);
    expect(SHOPEE_SHORTLINK_REGEX.test('/AbC123_-/')).toBe(true);
    expect(SHOPEE_SHORTLINK_REGEX.test('/nested/path')).toBe(false);
  });
});
