const COMPANY_ROLES = ['OWNER', 'EMPLOYEE'] as const;

type CompanyRole = (typeof COMPANY_ROLES)[number];

const isCompanyRole = (value: unknown): value is CompanyRole =>
  typeof value === 'string' && COMPANY_ROLES.includes(value as CompanyRole);

export { COMPANY_ROLES, isCompanyRole };
export type { CompanyRole };
