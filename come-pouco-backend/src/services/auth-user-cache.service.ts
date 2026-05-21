import type { CompanyRole } from '../types/company-role';
import type { UserRole } from '../types/user-role';

interface CachedAuthUser {
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  passwordChangedAt: Date | null;
}

interface AuthUserCacheEntry {
  user: CachedAuthUser;
  expiresAt: number;
}

const AUTH_USER_CACHE_TTL_MS = 30_000;
const authUserCache = new Map<number, AuthUserCacheEntry>();

const getCachedAuthUser = (userId: number): CachedAuthUser | null => {
  const entry = authUserCache.get(userId);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    authUserCache.delete(userId);
    return null;
  }

  return entry.user;
};

const setCachedAuthUser = (userId: number, user: CachedAuthUser): void => {
  authUserCache.set(userId, {
    user,
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS
  });
};

const invalidateAuthUserCache = (userId: number): void => {
  authUserCache.delete(userId);
};

export { AUTH_USER_CACHE_TTL_MS, getCachedAuthUser, invalidateAuthUserCache, setCachedAuthUser };
export type { CachedAuthUser };
