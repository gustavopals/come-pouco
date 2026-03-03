import type { CompanyRole } from './company-role.model';
import type { UserRole } from './user-role.model';

export interface AuthUser {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  company: {
    id: number;
    name: string;
    shopeeMode: 'TEST' | 'PROD';
    isShopeeConfiguredForMode: boolean;
  } | null;
  twoFactorEnabled: boolean;
  twoFactorConfirmedAt: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface TwoFactorRequiredResponse {
  twoFactorRequired?: true;
  requires2fa?: true;
  tempToken?: string;
  challengeId?: string;
}

export type LoginResponse = AuthResponse | TwoFactorRequiredResponse;

export interface RegisterPayload {
  fullName: string;
  username: string;
  email?: string;
  password: string;
}

export interface TrustedDevice {
  id: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  userAgent: string | null;
  ip: string | null;
}

export interface ApiErrorResponse {
  message?: string;
  errorCode?: string;
  details?: unknown;
}
