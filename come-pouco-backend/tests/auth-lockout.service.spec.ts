import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertNotLocked,
  recordFailedAttempt,
  resetFailedAttempts
} from '../src/services/auth-lockout.service';

describe('auth-lockout.service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks login after the configured number of failed attempts and unlocks after the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T10:00:00.000Z'));
    const identifier = `lockout-${Date.now()}@test.local`;

    for (let index = 0; index < 4; index += 1) {
      recordFailedAttempt('login', identifier);
      expect(() => assertNotLocked('login', identifier)).not.toThrow();
    }

    recordFailedAttempt('login', identifier);

    expect(() => assertNotLocked('login', identifier)).toThrow(
      expect.objectContaining({
        statusCode: 429,
        errorCode: 'AUTH_LOGIN_LOCKED'
      })
    );

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(() => assertNotLocked('login', identifier)).not.toThrow();
  });

  it('resets failed attempts for a scope and identifier', () => {
    const identifier = `reset-${Date.now()}@test.local`;

    for (let index = 0; index < 5; index += 1) {
      recordFailedAttempt('2fa', identifier);
    }

    expect(() => assertNotLocked('2fa', identifier)).toThrow(
      expect.objectContaining({
        statusCode: 429,
        errorCode: 'AUTH_2FA_LOCKED'
      })
    );

    resetFailedAttempts('2fa', identifier);

    expect(() => assertNotLocked('2fa', identifier)).not.toThrow();
  });
});
