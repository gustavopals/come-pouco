import { CompanyRole, Prisma, UserRole } from '@prisma/client';

import { truncate, uniqueSuffix } from './factory-utils';

export const buildUser = (
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {}
): Prisma.UserUncheckedCreateInput => {
  const username = `user_${uniqueSuffix(12)}`;

  return {
    fullName: truncate(`Test User ${uniqueSuffix(8)}`, 120),
    username,
    email: `${username}@test.local`,
    passwordHash: '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi6h4qQbYc8xEwq4MVx8pX4rA9x7mXW',
    role: UserRole.USER,
    companyRole: CompanyRole.EMPLOYEE,
    publicSlug: username.replace('_', '-'),
    ...overrides
  };
};
