import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => {
  const authLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  return {
    env: {
      appEnv: 'development',
      jwt: {
        secret: 'test-secret',
        expiresIn: '8h'
      },
      trustedDeviceDays: 30,
      publicAppUrl: 'https://app.test.local'
    },
    prisma: {
      $transaction: vi.fn(),
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      company: {
        findFirst: vi.fn(),
        create: vi.fn()
      },
      trustedDevice: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn()
      },
      twoFactorBackupCode: {
        findFirst: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn()
      },
      passwordResetToken: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn()
      }
    },
    bcrypt: {
      compare: vi.fn(),
      hash: vi.fn()
    },
    companyService: {
      getCompanyById: vi.fn(),
      resolveActiveShopeePlatform: vi.fn()
    },
    authLockout: {
      assertNotLocked: vi.fn(),
      recordFailedAttempt: vi.fn(),
      resetFailedAttempts: vi.fn()
    },
    authUserCache: {
      invalidateAuthUserCache: vi.fn()
    },
    email: {
      sendEmail: vi.fn()
    },
    cryptoUtils: {
      decryptValue: vi.fn(),
      encryptValue: vi.fn(),
      hashValue: vi.fn(),
      randomNumericCode: vi.fn(),
      randomToken: vi.fn(),
      signValue: vi.fn(),
      verifySignedValue: vi.fn()
    },
    totp: {
      buildOtpAuthUrl: vi.fn(),
      generateBase32Secret: vi.fn(),
      verifyTotp: vi.fn()
    },
    qrcode: {
      toDataURL: vi.fn()
    },
    authLogger,
    logger: {
      child: vi.fn(() => authLogger)
    }
  };
});

vi.mock('../src/config/env', () => ({
  default: mocks.env
}));

vi.mock('../src/config/prisma', () => ({
  default: mocks.prisma
}));

vi.mock('../src/lib/logger', () => ({
  logger: mocks.logger
}));

vi.mock('bcryptjs', () => ({
  default: mocks.bcrypt
}));

vi.mock('../src/services/company.service', () => mocks.companyService);

vi.mock('../src/services/auth-lockout.service', () => mocks.authLockout);

vi.mock('../src/services/auth-user-cache.service', () => mocks.authUserCache);

vi.mock('../src/services/email/email.service', () => mocks.email);

vi.mock('../src/utils/crypto', () => mocks.cryptoUtils);

vi.mock('../src/utils/totp', () => mocks.totp);

vi.mock('qrcode', () => ({
  default: mocks.qrcode
}));

import {
  TRUSTED_DEVICE_COOKIE_NAME,
  adminResetTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  forgotPassword,
  listTrustedDevices,
  login,
  loginWithTwoFactor,
  register,
  resetPassword,
  revokeTrustedDevice,
  setupTwoFactor
} from '../src/services/auth.service';

const company = {
  id: 10,
  name: 'Empresa Teste',
  shopeeMode: 'TEST' as const
};

const user = {
  id: 7,
  fullName: 'Ana Creator',
  username: 'ana',
  email: 'ana@test.local',
  role: 'USER' as const,
  companyId: 10,
  companyRole: 'EMPLOYEE' as const,
  passwordChangedAt: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  twoFactorSecretPending: null,
  twoFactorPendingCreatedAt: null,
  twoFactorConfirmedAt: null,
  passwordHash: 'hash'
};

const makeTwoFactorUser = () => ({
  ...user,
  twoFactorEnabled: true,
  twoFactorSecret: 'encrypted-secret',
  twoFactorConfirmedAt: new Date('2026-05-21T10:00:00.000Z')
});

describe('auth.service', () => {
  beforeEach(() => {
    mocks.authLockout.assertNotLocked.mockReturnValue(undefined);
    mocks.authLockout.recordFailedAttempt.mockReturnValue(undefined);
    mocks.authLockout.resetFailedAttempts.mockReturnValue(undefined);
    mocks.companyService.getCompanyById.mockResolvedValue(company);
    mocks.companyService.resolveActiveShopeePlatform.mockReturnValue({
      platformId: 3,
      source: 'TEST'
    });
    mocks.bcrypt.compare.mockResolvedValue(true);
    mocks.bcrypt.hash.mockResolvedValue('new-password-hash');
    mocks.cryptoUtils.decryptValue.mockReturnValue('BASE32SECRET');
    mocks.cryptoUtils.hashValue.mockImplementation((value: string) => `hash:${value}`);
    mocks.cryptoUtils.randomToken.mockReturnValue('raw-trusted-device-token');
    mocks.cryptoUtils.randomNumericCode
      .mockReturnValueOnce('11112222')
      .mockReturnValueOnce('33334444')
      .mockReturnValueOnce('55556666')
      .mockReturnValueOnce('77778888')
      .mockReturnValueOnce('99990000')
      .mockReturnValueOnce('12121212')
      .mockReturnValueOnce('34343434')
      .mockReturnValueOnce('56565656')
      .mockReturnValueOnce('78787878')
      .mockReturnValueOnce('90909090');
    mocks.cryptoUtils.signValue.mockReturnValue('signed-token');
    mocks.cryptoUtils.verifySignedValue.mockReturnValue(true);
    mocks.cryptoUtils.encryptValue.mockReturnValue('encrypted-pending-secret');
    mocks.totp.generateBase32Secret.mockReturnValue('ABCD EFGH IJKL MNOP');
    mocks.totp.buildOtpAuthUrl.mockReturnValue('otpauth://totp/ComePouco:ana?secret=ABC');
    mocks.totp.verifyTotp.mockReturnValue(false);
    mocks.qrcode.toDataURL.mockResolvedValue('data:image/png;base64,qr');
    mocks.prisma.user.findFirst.mockResolvedValue(user);
    mocks.prisma.user.findUnique.mockResolvedValue(makeTwoFactorUser());
    mocks.prisma.user.create.mockResolvedValue(user);
    mocks.prisma.company.findFirst.mockResolvedValue({ id: 10 });
    mocks.prisma.company.create.mockResolvedValue({ id: 10 });
    mocks.prisma.trustedDevice.findFirst.mockResolvedValue(null);
    mocks.prisma.trustedDevice.findMany.mockResolvedValue([]);
    mocks.prisma.trustedDevice.update.mockResolvedValue({});
    mocks.prisma.trustedDevice.create.mockResolvedValue({});
    mocks.prisma.twoFactorBackupCode.findFirst.mockResolvedValue(null);
    mocks.prisma.twoFactorBackupCode.update.mockResolvedValue({});
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue(null);
    mocks.prisma.passwordResetToken.findUnique.mockResolvedValue(null);
    mocks.prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.passwordResetToken.create.mockResolvedValue({});
    mocks.prisma.trustedDevice.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.user.update.mockResolvedValue({});
    mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      if (typeof input === 'function') {
        return input(mocks.prisma);
      }

      return input;
    });
    mocks.email.sendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('logs in with valid credentials and returns public user context when 2FA is disabled', async () => {
    const result = await login({ identifier: ' ANA ', password: 'correct' });

    expect('token' in result).toBe(true);
    expect(result).toMatchObject({
      user: {
        id: 7,
        username: 'ana',
        company: {
          id: 10,
          isShopeeConfiguredForMode: true
        },
        twoFactorEnabled: false
      }
    });
    expect(mocks.authLockout.assertNotLocked).toHaveBeenCalledWith('login', ' ANA ');
    expect(mocks.bcrypt.compare).toHaveBeenCalledWith('correct', 'hash');
    expect(mocks.authLockout.resetFailedAttempts).toHaveBeenCalledWith('login', ' ANA ');
  });

  it('records failed login attempts for unknown users and invalid passwords', async () => {
    mocks.prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      login({ identifier: 'missing@test.local', password: 'wrong' })
    ).rejects.toMatchObject({
      statusCode: 401,
      errorCode: 'AUTH_INVALID_CREDENTIALS'
    });
    expect(mocks.authLockout.recordFailedAttempt).toHaveBeenCalledWith(
      'login',
      'missing@test.local'
    );

    mocks.prisma.user.findFirst.mockResolvedValueOnce(user);
    mocks.bcrypt.compare.mockResolvedValueOnce(false);

    await expect(login({ identifier: 'ana', password: 'wrong' })).rejects.toMatchObject({
      statusCode: 401,
      errorCode: 'AUTH_INVALID_CREDENTIALS'
    });
    expect(mocks.authLockout.recordFailedAttempt).toHaveBeenCalledWith('login', 'ana');
  });

  it('surfaces login lockouts before touching the database', async () => {
    mocks.authLockout.assertNotLocked.mockImplementationOnce(() => {
      const error = new Error('locked') as Error & { statusCode: number; errorCode: string };
      error.statusCode = 429;
      error.errorCode = 'AUTH_LOGIN_LOCKED';
      throw error;
    });

    await expect(login({ identifier: 'ana', password: 'correct' })).rejects.toMatchObject({
      statusCode: 429,
      errorCode: 'AUTH_LOGIN_LOCKED'
    });
    expect(mocks.prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('returns a temporary 2FA challenge when 2FA is enabled and no trusted device is present', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(makeTwoFactorUser());

    const result = await login({ identifier: 'ana', password: 'correct' });

    expect(result).toMatchObject({
      twoFactorRequired: true,
      requires2fa: true,
      challengeId: expect.any(String),
      tempToken: expect.any(String)
    });
    expect(mocks.prisma.trustedDevice.findFirst).not.toHaveBeenCalled();
  });

  it('bypasses 2FA when a valid trusted-device cookie is found', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(makeTwoFactorUser());
    mocks.prisma.trustedDevice.findFirst.mockResolvedValue({ id: 55 });

    const result = await login({
      identifier: 'ana',
      password: 'correct',
      cookieHeader: `${TRUSTED_DEVICE_COOKIE_NAME}=v1.raw-trusted-device-token.signed-token`
    });

    expect('token' in result).toBe(true);
    expect(mocks.cryptoUtils.verifySignedValue).toHaveBeenCalledWith(
      'raw-trusted-device-token',
      'signed-token',
      'test-secret'
    );
    expect(mocks.prisma.trustedDevice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 7,
          tokenHash: 'hash:raw-trusted-device-token'
        })
      })
    );
    expect(mocks.prisma.trustedDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55 }
      })
    );
  });

  it('rejects invalid 2FA codes and records failed 2FA attempts', async () => {
    const tempToken = jwt.sign({ sub: 7, purpose: '2fa_pending' }, 'test-secret', {
      expiresIn: '5m'
    });
    mocks.totp.verifyTotp.mockReturnValue(false);
    mocks.prisma.twoFactorBackupCode.findFirst.mockResolvedValue(null);

    await expect(loginWithTwoFactor({ tempToken, code: '000000' })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'AUTH_INVALID_2FA_CODE'
    });
    expect(mocks.authLockout.recordFailedAttempt).toHaveBeenCalledWith('2fa', '7');
  });

  it('completes 2FA login, optionally creating a trusted-device token', async () => {
    const tempToken = jwt.sign({ sub: 7, purpose: '2fa_pending' }, 'test-secret', {
      expiresIn: '5m'
    });
    mocks.totp.verifyTotp.mockReturnValue(true);

    const result = await loginWithTwoFactor({
      tempToken,
      code: '123456',
      trustDevice: true,
      userAgent: 'Vitest Agent',
      ip: '127.0.0.1'
    });

    expect(result).toMatchObject({
      token: expect.any(String),
      trustedDeviceToken: 'v1.raw-trusted-device-token.signed-token',
      user: {
        id: 7,
        twoFactorEnabled: true
      }
    });
    expect(mocks.authLockout.resetFailedAttempts).toHaveBeenCalledWith('2fa', '7');
    expect(mocks.prisma.trustedDevice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        tokenHash: 'hash:raw-trusted-device-token',
        userAgent: 'Vitest Agent',
        ip: '127.0.0.1'
      })
    });
  });

  it('creates a password reset token and sends the reset email when the user exists', async () => {
    mocks.prisma.user.findFirst.mockResolvedValueOnce({ id: 7, email: 'ana@test.local' });

    await forgotPassword({ email: ' ANA@Test.Local ', requesterIp: '127.0.0.1' });

    expect(mocks.prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        tokenHash: expect.stringMatching(/^hash:/),
        expiresAt: expect.any(Date)
      })
    });
    expect(mocks.email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@test.local',
        subject: expect.any(String),
        html: expect.stringContaining('reset-password')
      })
    );
  });

  it('resets password, marks token as used, revokes trusted devices and invalidates auth cache', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    mocks.prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-id',
      userId: 7,
      usedAt: null,
      expiresAt
    });

    const result = await resetPassword({
      token: 'raw-reset-token-value',
      newPassword: 'NovaSenha123'
    });

    expect(result).toEqual({ userId: 7 });
    expect(mocks.prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'hash:raw-reset-token-value' },
      select: { id: true, userId: true, usedAt: true, expiresAt: true }
    });
    expect(mocks.prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'reset-token-id', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) }
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        passwordHash: 'new-password-hash',
        passwordChangedAt: expect.any(Date)
      }
    });
    expect(mocks.prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(mocks.authUserCache.invalidateAuthUserCache).toHaveBeenCalledWith(7);
  });

  it('registers a normalized user under the default company', async () => {
    const result = await register({
      fullName: ' Ana Creator ',
      username: ' ANA_CREATOR ',
      email: ' ANA@Test.Local ',
      password: 'SenhaForte123'
    });

    expect(result.user).toMatchObject({
      username: 'ana',
      companyId: 10
    });
    expect(mocks.bcrypt.hash).toHaveBeenCalledWith('SenhaForte123', 10);
    expect(mocks.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fullName: 'Ana Creator',
          username: 'ana_creator',
          email: 'ana@test.local',
          passwordHash: 'new-password-hash',
          companyId: 10,
          companyRole: 'EMPLOYEE'
        })
      })
    );
  });

  it('starts 2FA setup by storing a pending encrypted secret and returning QR data', async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      username: 'ana',
      twoFactorEnabled: false
    });

    const result = await setupTwoFactor(7);

    expect(result).toEqual({
      otpauthUrl: 'otpauth://totp/ComePouco:ana?secret=ABC',
      qrCodeDataUrl: 'data:image/png;base64,qr',
      secretMasked: 'ABCD EFGH IJKL MNOP'
    });
    expect(mocks.cryptoUtils.encryptValue).toHaveBeenCalledWith('ABCD EFGH IJKL MNOP');
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        twoFactorSecretPending: 'encrypted-pending-secret',
        twoFactorPendingCreatedAt: expect.any(Date)
      }
    });
  });

  it('confirms 2FA setup and replaces backup codes', async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      twoFactorEnabled: false,
      twoFactorSecretPending: 'encrypted-pending-secret',
      twoFactorPendingCreatedAt: new Date()
    });
    mocks.cryptoUtils.decryptValue.mockReturnValue('BASE32SECRET');
    mocks.totp.verifyTotp.mockReturnValueOnce(true);

    const result = await confirmTwoFactor(7, '123456');

    expect(result.backupCodes).toHaveLength(10);
    expect(result.backupCodes[0]).toBe('1111-2222');
    expect(mocks.prisma.twoFactorBackupCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7 }
    });
    expect(mocks.prisma.twoFactorBackupCode.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        {
          userId: 7,
          codeHash: 'hash:11112222'
        }
      ])
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        twoFactorEnabled: true,
        twoFactorSecret: 'encrypted-pending-secret',
        twoFactorSecretPending: null
      })
    });
  });

  it('disables 2FA after validating password and TOTP code', async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce(makeTwoFactorUser());
    mocks.bcrypt.compare.mockResolvedValueOnce(true);
    mocks.totp.verifyTotp.mockReturnValueOnce(true);

    await disableTwoFactor({ userId: 7, password: 'correct', code: '123456' });

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorSecretPending: null,
        twoFactorPendingCreatedAt: null,
        twoFactorConfirmedAt: null
      }
    });
    expect(mocks.prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
  });

  it('lists and revokes trusted devices scoped to the current user', async () => {
    const createdAt = new Date('2026-05-01T10:00:00.000Z');
    const expiresAt = new Date('2026-06-01T10:00:00.000Z');
    const lastUsedAt = new Date('2026-05-20T10:00:00.000Z');
    mocks.prisma.trustedDevice.findMany.mockResolvedValueOnce([
      {
        id: 55,
        createdAt,
        expiresAt,
        lastUsedAt,
        userAgent: 'Vitest',
        ip: '127.0.0.1'
      }
    ]);

    const devices = await listTrustedDevices(7);

    expect(devices).toEqual([
      {
        id: 55,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastUsedAt: lastUsedAt.toISOString(),
        userAgent: 'Vitest',
        ip: '127.0.0.1'
      }
    ]);
    expect(mocks.prisma.trustedDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 7 })
      })
    );

    mocks.prisma.trustedDevice.deleteMany.mockResolvedValueOnce({ count: 1 });
    await revokeTrustedDevice(7, 55);

    expect(mocks.prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 55,
        userId: 7
      }
    });
  });

  it('raises not found when revoking a trusted device outside user scope', async () => {
    mocks.prisma.trustedDevice.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(revokeTrustedDevice(7, 55)).rejects.toMatchObject({
      statusCode: 404,
      errorCode: 'AUTH_TRUSTED_DEVICE_NOT_FOUND'
    });
  });

  it('lets admins reset 2FA for an existing target user', async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce({ id: 99 });

    await adminResetTwoFactor(99);

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        twoFactorEnabled: false,
        twoFactorSecret: null
      })
    });
    expect(mocks.prisma.twoFactorBackupCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: 99 }
    });
    expect(mocks.prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: 99 } });
  });
});
