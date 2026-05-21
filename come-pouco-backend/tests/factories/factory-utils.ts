import { faker } from '@faker-js/faker';

export const uniqueSuffix = (length = 10): string =>
  faker.string.alphanumeric({ length, casing: 'lower' });

export const truncate = (value: string, maxLength: number): string => value.slice(0, maxLength);
