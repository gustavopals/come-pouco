export {};

import type { UserRole } from '../../types/user-role';
import type { CompanyRole } from '../../types/company-role';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      userId?: number;
      userRole?: UserRole;
      companyId?: number | null;
      companyRole?: CompanyRole | null;
      publicRateLimitIp?: string;
      publicIpHash?: string;
      publicUserAgent?: string;
      publicReferrer?: string;
      log: Logger;
    }
  }
}
