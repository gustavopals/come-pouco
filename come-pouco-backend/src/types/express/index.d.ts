export {};

import type { UserRole } from '../../types/user-role';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: UserRole;
    }
  }
}
