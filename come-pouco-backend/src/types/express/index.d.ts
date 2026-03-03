export {};

import type { UserRole } from '../../types/user-role';
import type { CompanyRole } from '../../types/company-role';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: UserRole;
      companyId?: number | null;
      companyRole?: CompanyRole | null;
    }
  }
}
