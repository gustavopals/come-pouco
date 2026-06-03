import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export const isLikelyShopeeUrl = (input: string): boolean => {
  const value = input.trim();

  if (!value) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  return (
    host === 'shope.ee' ||
    host === 'shopee.com.br' ||
    host.endsWith('.shopee.com.br') ||
    host === 'br.shp.ee' ||
    host === 'shp.ee' ||
    host.endsWith('.shp.ee')
  );
};

export const shopeeUrlValidator: ValidatorFn = (
  control: AbstractControl<string | null | undefined>,
): ValidationErrors | null => {
  const value = control.value?.trim();

  if (!value) {
    return null;
  }

  return isLikelyShopeeUrl(value) ? null : { shopeeUrl: true };
};
