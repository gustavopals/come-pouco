const USER_ROLES = ['ADMIN', 'USER'] as const;

type UserRole = (typeof USER_ROLES)[number];

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && USER_ROLES.includes(value as UserRole);

export { USER_ROLES, isUserRole };
export type { UserRole };
