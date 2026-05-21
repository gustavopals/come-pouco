import { hashValue } from '../utils/crypto';
import HttpError from '../utils/httpError';

type AuthLockoutScope = 'login' | '2fa';

interface LockoutState {
  failedAttempts: number;
  firstFailedAt: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 1000;
const MAX_LOCKOUT_BUCKETS = 5000;
const lockoutBuckets = new Map<string, LockoutState>();
let lastPruneAt = Date.now();

const normalizeIdentifier = (identifier: string): string => identifier.trim().toLowerCase();

const buildBucketKey = (scope: AuthLockoutScope, identifier: string): string => {
  const normalized = scope === 'login' ? normalizeIdentifier(identifier) : identifier.trim();
  return `${scope}:${hashValue(normalized)}`;
};

const getMessage = (scope: AuthLockoutScope): string =>
  scope === 'login'
    ? 'Muitas tentativas de login falharam. Tente novamente em alguns minutos.'
    : 'Muitas tentativas de 2FA falharam. Tente novamente em alguns minutos.';

const getErrorCode = (scope: AuthLockoutScope): string =>
  scope === 'login' ? 'AUTH_LOGIN_LOCKED' : 'AUTH_2FA_LOCKED';

const clearExpiredState = (key: string, state: LockoutState, now: number): boolean => {
  if (state.lockedUntil && state.lockedUntil <= now) {
    lockoutBuckets.delete(key);
    return true;
  }

  if (!state.lockedUntil && now - state.firstFailedAt > LOCKOUT_WINDOW_MS) {
    lockoutBuckets.delete(key);
    return true;
  }

  return false;
};

const pruneExpiredBuckets = (now = Date.now()): void => {
  lockoutBuckets.forEach((state, key) => {
    clearExpiredState(key, state, now);
  });
  lastPruneAt = now;
};

const pruneIfDue = (now: number): void => {
  if (now - lastPruneAt >= PRUNE_INTERVAL_MS) {
    pruneExpiredBuckets(now);
  }
};

const trimOldestBuckets = (): void => {
  if (lockoutBuckets.size <= MAX_LOCKOUT_BUCKETS) {
    return;
  }

  const overflow = lockoutBuckets.size - MAX_LOCKOUT_BUCKETS;
  const oldestKeys = [...lockoutBuckets.entries()]
    .sort(([, left], [, right]) => left.firstFailedAt - right.firstFailedAt)
    .slice(0, overflow)
    .map(([key]) => key);

  oldestKeys.forEach((key) => lockoutBuckets.delete(key));
};

const cleanupTimer = setInterval(() => {
  pruneExpiredBuckets();
  trimOldestBuckets();
}, PRUNE_INTERVAL_MS);
cleanupTimer.unref?.();

const assertNotLocked = (scope: AuthLockoutScope, identifier: string): void => {
  const key = buildBucketKey(scope, identifier);
  const now = Date.now();
  pruneIfDue(now);

  const state = lockoutBuckets.get(key);

  if (!state) {
    return;
  }

  if (clearExpiredState(key, state, now)) {
    return;
  }

  if (!state.lockedUntil || state.lockedUntil <= now) {
    return;
  }

  throw new HttpError(429, getMessage(scope), getErrorCode(scope), {
    retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000)
  });
};

const recordFailedAttempt = (scope: AuthLockoutScope, identifier: string): void => {
  const key = buildBucketKey(scope, identifier);
  const now = Date.now();
  pruneIfDue(now);

  const existing = lockoutBuckets.get(key);

  if (!existing || clearExpiredState(key, existing, now)) {
    lockoutBuckets.set(key, {
      failedAttempts: 1,
      firstFailedAt: now,
      lockedUntil: null
    });
    trimOldestBuckets();
    return;
  }

  const failedAttempts = existing.failedAttempts + 1;

  lockoutBuckets.set(key, {
    failedAttempts,
    firstFailedAt: existing.firstFailedAt,
    lockedUntil:
      failedAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : existing.lockedUntil
  });
  trimOldestBuckets();
};

const resetFailedAttempts = (scope: AuthLockoutScope, identifier: string): void => {
  lockoutBuckets.delete(buildBucketKey(scope, identifier));
};

export { assertNotLocked, recordFailedAttempt, resetFailedAttempts };
