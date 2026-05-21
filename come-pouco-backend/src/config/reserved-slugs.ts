const RESERVED_PUBLIC_SLUGS = [
  'admin',
  'api',
  'assets',
  'auth',
  'dashboard',
  'demo',
  'health',
  'home',
  'login',
  'logout',
  'p',
  'public',
  'register',
  'reset-password',
  'users'
] as const;

const PUBLIC_SLUG_MIN_LENGTH = 3;
const PUBLIC_SLUG_MAX_LENGTH = 32;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugifyPublicSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const isReservedPublicSlug = (value: string): boolean =>
  RESERVED_PUBLIC_SLUGS.includes(value as (typeof RESERVED_PUBLIC_SLUGS)[number]);

export {
  PUBLIC_SLUG_MAX_LENGTH,
  PUBLIC_SLUG_MIN_LENGTH,
  PUBLIC_SLUG_PATTERN,
  RESERVED_PUBLIC_SLUGS,
  isReservedPublicSlug,
  slugifyPublicSlug
};
