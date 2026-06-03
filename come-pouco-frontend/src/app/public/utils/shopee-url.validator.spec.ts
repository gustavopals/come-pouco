import { FormControl } from '@angular/forms';

import { isLikelyShopeeUrl, shopeeUrlValidator } from './shopee-url.validator';

describe('shopeeUrlValidator', () => {
  it('aceita URL canonica de produto da Shopee', () => {
    expect(isLikelyShopeeUrl('https://shopee.com.br/product/123/456?sp_atk=abc')).toBe(true);
  });

  it('aceita shortlink shope.ee', () => {
    expect(isLikelyShopeeUrl('https://shope.ee/8f7Example')).toBe(true);
  });

  it('aceita shortlink s.shopee.com.br', () => {
    expect(isLikelyShopeeUrl('https://s.shopee.com.br/8f7Example')).toBe(true);
  });

  it('aceita shortlink br.shp.ee', () => {
    expect(isLikelyShopeeUrl('https://br.shp.ee/9ZkLmN4pQ')).toBe(true);
  });

  it('rejeita dominio fora da Shopee', () => {
    expect(isLikelyShopeeUrl('https://example.com/produto')).toBe(false);
  });

  it('rejeita URL malformada', () => {
    expect(isLikelyShopeeUrl('nao e uma url')).toBe(false);
  });

  it('rejeita protocolo sem HTTP', () => {
    expect(isLikelyShopeeUrl('ftp://shopee.com.br/product/123/456')).toBe(false);
  });

  it('deixa campo vazio para o required e marca URL invalida', () => {
    expect(shopeeUrlValidator(new FormControl(''))).toBeNull();
    expect(shopeeUrlValidator(new FormControl('https://loja.example.test'))).toEqual({
      shopeeUrl: true,
    });
  });
});
