import type { CompanyRole } from './company-role.model';
import type { UserRole } from './user-role.model';

export interface User {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface CreateUserPayload {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  role: UserRole;
  companyId?: number | null;
  companyRole?: CompanyRole | null;
}

export interface UpdateUserPayload {
  fullName?: string;
  username?: string;
  email?: string | null;
  password?: string;
  role?: UserRole;
  companyId?: number | null;
  companyRole?: CompanyRole | null;
}