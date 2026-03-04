import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import QRCode from 'qrcode';

import env from '../config/env';
import prisma from '../config/prisma';
import * as companyService from './company.service';
import type { CompanyRole } from '../types/company-role';
import type { UserRole } from '../types/user-role';
import { parseCookieHeader } from '../utils/cookies';
import { decryptValue, encryptValue, hashValue, randomNumericCode, randomToken, signValue, verifySignedValue } from '../utils/crypto';
import { buildOtpAuthUrl, generateBase32Secret, verifyTotp } from '../utils/totp';
import HttpError from '../utils/httpError';

const TEMP_TOKEN_PURPOSE = '2fa_pending';
const TEMP_TOKEN_TTL = '5m';
const TRUSTED_DEVICE_COOKIE_NAME = 'cp_td';
const TRUSTED_DEVICE_COOKIE_VERSION = 'v1';

interface UserRecord {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorSecretPending: string | null;
  twoFactorPendingCreatedAt: Date | null;
  twoFactorConfirmedAt: Date | null;
  company: {
    id: number;
    name: string;
    shopeeMode: 'TEST' | 'PROD';
    isShopeeConfiguredForMode: boolean;
  } | null;
  passwordHash?: string;
}

interface LoginInput {
  identifier: string;
  password: string;
  cookieHeader?: string;
}

interface LoginTwoFactorInput {
  tempToken: string;
  code: string;
  trustDevice?: boolean;
  userAgent?: string;
  ip?: string;
}

interface RegisterInput {
  fullName: string;
  username: string;
  email?: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: PublicUser;
}

interface TwoFactorPendingResponse {
  twoFactorRequired: true;
  requires2fa: true;
  tempToken: string;
  challengeId: string;
}

interface TwoFactorLoginResponse extends AuthResponse {
  trustedDeviceToken?: string;
}

interface TwoFactorSetupResponse {
  otpauthUrl: string;
  qrCodeDataUrl: string;
  secretMasked: string;
}

interface TwoFactorConfirmResponse {
  backupCodes: string[];
}

interface PublicUser {
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

interface TrustedDeviceOutput {
  id: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  userAgent: string | null;
  ip: string | null;
}

type BaseUserRecord = {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorSecretPending: string | null;
  twoFactorPendingCreatedAt: Date | null;
  twoFactorConfirmedAt: Date | null;
  passwordHash?: string;
};

const resolveSafeRole = (role: unknown, username: string, email: string | null): UserRole => {
  if (role === 'ADMIN' || role === 'USER') {
    return role;
  }

  if (env.appEnv === 'development') {
    console.debug(`[auth] invalid role found for user=${username} email=${email || '-'}; defaulting to USER.`);
  }

  return 'USER';
};

const normalizeUserState = (user: BaseUserRecord): BaseUserRecord => {
  return {
    ...user,
    role: resolveSafeRole(user.role, user.username, user.email),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    twoFactorSecret: user.twoFactorSecret || null,
    twoFactorSecretPending: user.twoFactorSecretPending || null
  };
};

const mapAuthReadError = (error: unknown, context: string): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2022' || error.code === 'P2021')) {
    if (env.appEnv === 'development') {
      console.debug(`[auth] ${context} failed due to database schema mismatch (${error.code}).`);
    }
    throw new HttpError(
      400,
      'Estrutura de autenticacao desatualizada. Execute as migracoes do banco e tente novamente.',
      'AUTH_SCHEMA_OUTDATED'
    );
  }

  throw error;
};

const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: user.role,
  companyId: user.companyId,
  companyRole: user.companyRole,
  company: user.company,
  twoFactorEnabled: user.twoFactorEnabled,
  twoFactorConfirmedAt: user.twoFactorConfirmedAt ? user.twoFactorConfirmedAt.toISOString() : null
});

const attachCompanyContext = async (user: BaseUserRecord): Promise<UserRecord> => {
  const normalizedUser = normalizeUserState(user);

  if (!normalizedUser.companyId) {
    return {
      ...normalizedUser,
      company: null
    };
  }

  const company = await companyService.getCompanyById(normalizedUser.companyId);

  if (!company) {
    return {
      ...normalizedUser,
      company: null
    };
  }

  return {
    ...normalizedUser,
    company: {
      id: company.id,
      name: company.name,
      shopeeMode: company.shopeeMode,
      isShopeeConfiguredForMode: Boolean(companyService.resolveActiveShopeePlatform(company).platformId)
    }
  };
};

const buildAuthResponse = (user: UserRecord): AuthResponse => {
  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyRole: user.companyRole,
      company: user.company
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn
    }
  );

  return {
    token,
    user: toPublicUser(user)
  };
};

const createTempTwoFactorToken = (userId: number): string => {
  return jwt.sign(
    {
      sub: userId,
      purpose: TEMP_TOKEN_PURPOSE
    },
    env.jwt.secret,
    { expiresIn: TEMP_TOKEN_TTL }
  );
};

const maskTwoFactorSecret = (secret: string): string => {
  return secret
    .replace(/\s+/g, '')
    .toUpperCase()
    .match(/.{1,4}/g)
    ?.join(' ') ?? '';
};

const parseTempToken = (tempToken: string): number => {
  try {
    const decoded = jwt.verify(tempToken, env.jwt.secret);

    if (typeof decoded === 'string') {
      throw new HttpError(401, 'Token temporario invalido.', 'AUTH_TOKEN_INVALID');
    }

    const payload = decoded as JwtPayload;
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || payload.purpose !== TEMP_TOKEN_PURPOSE) {
      throw new HttpError(401, 'Token temporario invalido.', 'AUTH_TOKEN_INVALID');
    }

    return userId;
  } catch {
    throw new HttpError(401, 'Token temporario invalido ou expirado.', 'AUTH_TOKEN_EXPIRED');
  }
};

const findUserByIdentifier = async (identifier: string): Promise<UserRecord | null> => {
  const normalized = identifier.trim().toLowerCase();

  let user;
  try {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: normalized },
          {
            email: {
              equals: normalized,
              mode: 'insensitive'
            }
          }
        ]
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        companyRole: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorSecretPending: true,
        twoFactorPendingCreatedAt: true,
        twoFactorConfirmedAt: true,
        passwordHash: true
      }
    });
  } catch (error) {
    return mapAuthReadError(error, 'findUserByIdentifier');
  }

  if (!user) {
    return null;
  }

  return attachCompanyContext(user);
};

const getUserById = async (userId: number): Promise<UserRecord | null> => {
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        companyRole: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorSecretPending: true,
        twoFactorPendingCreatedAt: true,
        twoFactorConfirmedAt: true
      }
    });
  } catch (error) {
    return mapAuthReadError(error, 'getUserById');
  }

  if (!user) {
    return null;
  }

  return attachCompanyContext(user);
};

const ensureValidTrustedDevice = async (userId: number, cookieHeader?: string): Promise<boolean> => {
  const cookies = parseCookieHeader(cookieHeader);
  const rawCookie = cookies[TRUSTED_DEVICE_COOKIE_NAME];

  if (!rawCookie) {
    return false;
  }

  const [version, deviceToken, signature] = rawCookie.split('.');

  if (version !== TRUSTED_DEVICE_COOKIE_VERSION || !deviceToken || !signature) {
    if (env.appEnv === 'development') {
      console.debug(`[auth/trusted-device] malformed cookie for user=${userId}`);
    }
    return false;
  }

  if (!verifySignedValue(deviceToken, signature, env.jwt.secret)) {
    if (env.appEnv === 'development') {
      console.debug(`[auth/trusted-device] invalid signature for user=${userId}`);
    }
    return false;
  }

  const tokenHash = hashValue(deviceToken);
  const now = new Date();

  const trustedDevice = await prisma.trustedDevice.findFirst({
    where: {
      userId,
      tokenHash,
      expiresAt: {
        gt: now
      }
    },
    select: {
      id: true
    }
  });

  if (!trustedDevice) {
    return false;
  }

  await prisma.trustedDevice.update({
    where: { id: trustedDevice.id },
    data: { lastUsedAt: now }
  });

  return true;
};

const createTrustedDevice = async ({
  userId,
  userAgent,
  ip
}: {
  userId: number;
  userAgent?: string;
  ip?: string;
}): Promise<string> => {
  const token = randomToken(32);
  const tokenHash = hashValue(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.trustedDeviceDays * 24 * 60 * 60 * 1000);

  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      lastUsedAt: now,
      userAgent: userAgent?.slice(0, 255) || null,
      ip: ip?.slice(0, 64) || null
    }
  });

  const signature = signValue(token, env.jwt.secret);
  return `${TRUSTED_DEVICE_COOKIE_VERSION}.${token}.${signature}`;
};

const normalizeBackupCode = (code: string): string => {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const generateBackupCodes = (): string[] => {
  return Array.from({ length: 10 }, () => {
    const raw = randomNumericCode(8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
};

const useBackupCode = async (userId: number, code: string): Promise<boolean> => {
  const normalized = normalizeBackupCode(code);

  if (!normalized) {
    return false;
  }

  const codeHash = hashValue(normalized);

  const backup = await prisma.twoFactorBackupCode.findFirst({
    where: {
      userId,
      codeHash,
      usedAt: null
    },
    select: { id: true }
  });

  if (!backup) {
    return false;
  }

  await prisma.twoFactorBackupCode.update({
    where: { id: backup.id },
    data: { usedAt: new Date() }
  });

  return true;
};

const verifyTwoFactorCode = async ({ user, code }: { user: UserRecord; code: string }): Promise<boolean> => {
  if (user.twoFactorSecret) {
    try {
      const secret = decryptValue(user.twoFactorSecret);
      if (verifyTotp({ secret, token: code, window: 1 })) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return useBackupCode(user.id, code);
};

const login = async ({ identifier, password, cookieHeader }: LoginInput): Promise<AuthResponse | TwoFactorPendingResponse> => {
  const user = await findUserByIdentifier(identifier);

  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'Usuario/e-mail ou senha invalidos.', 'AUTH_INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new HttpError(401, 'Usuario/e-mail ou senha invalidos.', 'AUTH_INVALID_CREDENTIALS');
  }

  if (env.appEnv === 'development') {
    console.debug(`[auth/login] user=${user.id} twoFactorEnabled=${user.twoFactorEnabled}`);
  }

  if (!user.twoFactorEnabled) {
    return buildAuthResponse(user);
  }

  if (!user.twoFactorSecret) {
    if (env.appEnv === 'development') {
      console.debug(`[auth/login] invalid 2FA state for user=${user.id}: twoFactorEnabled=true and secret missing`);
    }
    throw new HttpError(
      400,
      '2FA habilitado sem secret configurado. Reconfigure o 2FA na tela de seguranca.',
      'AUTH_2FA_STATE_INVALID'
    );
  }

  const trusted = await ensureValidTrustedDevice(user.id, cookieHeader);

  if (trusted) {
    if (env.appEnv === 'development') {
      console.debug(`[auth/login] trusted-device bypass user=${user.id}`);
    }
    return buildAuthResponse(user);
  }

  const challenge = createTempTwoFactorToken(user.id);

  return {
    twoFactorRequired: true,
    requires2fa: true,
    tempToken: challenge,
    challengeId: challenge
  };
};

const loginWithTwoFactor = async ({ tempToken, code, trustDevice, userAgent, ip }: LoginTwoFactorInput): Promise<TwoFactorLoginResponse> => {
  const userId = parseTempToken(tempToken);
  const user = await getUserById(userId);

  if (!user || !user.twoFactorEnabled) {
    throw new HttpError(401, '2FA nao esta habilitado para este usuario.', 'AUTH_2FA_NOT_ENABLED');
  }

  const validCode = await verifyTwoFactorCode({ user, code });

  if (!validCode) {
    throw new HttpError(400, 'Codigo 2FA invalido.', 'AUTH_INVALID_2FA_CODE');
  }

  const authResponse = buildAuthResponse(user);

  if (!trustDevice) {
    return authResponse;
  }

  const trustedDeviceToken = await createTrustedDevice({ userId: user.id, userAgent, ip });

  return {
    ...authResponse,
    trustedDeviceToken
  };
};

const normalizeEmail = (email?: string): string | null => {
  if (email === undefined) {
    return null;
  }

  const safeEmail = email.trim().toLowerCase();
  return safeEmail.length ? safeEmail : null;
};

const normalizeUsername = (username: string): string => {
  const normalized = username.trim().toLowerCase();

  if (!normalized.length) {
    throw new HttpError(400, 'Username e obrigatorio.', 'AUTH_INVALID_USERNAME');
  }

  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new HttpError(400, 'Username invalido. Use apenas letras, numeros, _ ou -.', 'AUTH_INVALID_USERNAME');
  }

  return normalized;
};

const register = async ({ fullName, username, email, password }: RegisterInput): Promise<AuthResponse> => {
  const safeFullName = fullName.trim();
  const safeUsername = normalizeUsername(username);
  const safeEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const defaultCompany =
      (await prisma.company.findFirst({ where: { name: 'Default Company' }, select: { id: true } })) ||
      (await prisma.company.create({ data: { name: 'Default Company' }, select: { id: true } }));

    const user = await prisma.user.create({
      data: {
        fullName: safeFullName,
        username: safeUsername,
        email: safeEmail,
        passwordHash,
        role: 'USER',
        companyId: defaultCompany.id,
        companyRole: 'EMPLOYEE'
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        companyRole: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorSecretPending: true,
        twoFactorPendingCreatedAt: true,
        twoFactorConfirmedAt: true,
        passwordHash: true
      }
    });

    const normalizedUser = await attachCompanyContext(user);

    return buildAuthResponse(normalizedUser);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Ja existe um usuario com este username ou e-mail.', 'AUTH_IDENTIFIER_CONFLICT');
    }

    throw error;
  }
};

const setupTwoFactor = async (userId: number): Promise<TwoFactorSetupResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      twoFactorEnabled: true
    }
  });

  if (!user) {
    throw new HttpError(404, 'Usuario nao encontrado.', 'AUTH_USER_NOT_FOUND');
  }

  if (user.twoFactorEnabled) {
    throw new HttpError(400, '2FA ja esta habilitado.', 'AUTH_2FA_ALREADY_ENABLED');
  }

  const secret = generateBase32Secret(20);
  const encryptedSecret = encryptValue(secret);
  const otpauthUrl = buildOtpAuthUrl({
    issuer: 'ApiShopeeConnect',
    label: user.username,
    secret
  });
  const secretMasked = maskTwoFactorSecret(secret);
  let qrCodeDataUrl = '';

  try {
    qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6
    });
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    throw new HttpError(500, 'Falha ao gerar QR Code local');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecretPending: encryptedSecret,
      twoFactorPendingCreatedAt: new Date()
    }
  });

  return { otpauthUrl, qrCodeDataUrl, secretMasked };
};

const confirmTwoFactor = async (userId: number, code: string): Promise<TwoFactorConfirmResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      twoFactorEnabled: true,
      twoFactorSecretPending: true,
      twoFactorPendingCreatedAt: true
    }
  });

  if (!user) {
    throw new HttpError(404, 'Usuario nao encontrado.', 'AUTH_USER_NOT_FOUND');
  }

  if (user.twoFactorEnabled) {
    throw new HttpError(400, '2FA ja esta habilitado.', 'AUTH_2FA_ALREADY_ENABLED');
  }

  if (!user.twoFactorSecretPending) {
    throw new HttpError(400, 'Setup de 2FA nao iniciado.', 'AUTH_2FA_SETUP_NOT_STARTED');
  }

  const createdAt = user.twoFactorPendingCreatedAt?.getTime() ?? 0;
  const maxAgeMs = 10 * 60 * 1000;

  if (Date.now() - createdAt > maxAgeMs) {
    throw new HttpError(400, 'Setup de 2FA expirado. Gere um novo QR code.', 'AUTH_2FA_SETUP_EXPIRED');
  }

  let secret = '';
  try {
    secret = decryptValue(user.twoFactorSecretPending);
  } catch {
    throw new HttpError(400, 'Nao foi possivel validar o setup de 2FA.', 'AUTH_2FA_STATE_INVALID');
  }

  const valid = verifyTotp({ secret, token: code, window: 1 });

  if (!valid) {
    throw new HttpError(400, 'Codigo invalido.', 'AUTH_INVALID_2FA_CODE');
  }

  const backupCodes = generateBackupCodes();
  const backupCodeRows = backupCodes.map((backupCode) => ({
    userId,
    codeHash: hashValue(normalizeBackupCode(backupCode))
  }));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorSecretPending,
        twoFactorSecretPending: null,
        twoFactorPendingCreatedAt: null,
        twoFactorConfirmedAt: new Date()
      }
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({ data: backupCodeRows })
  ]);

  return {
    backupCodes
  };
};

const resetTwoFactorByUserId = async (userId: number): Promise<void> => {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorSecretPending: null,
        twoFactorPendingCreatedAt: null,
        twoFactorConfirmedAt: null
      }
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.trustedDevice.deleteMany({ where: { userId } })
  ]);
};

const disableTwoFactor = async ({ userId, password, code }: { userId: number; password: string; code: string }): Promise<void> => {
  const user = await findUserByIdWithPassword(userId);

  if (!user) {
    throw new HttpError(404, 'Usuario nao encontrado.', 'AUTH_USER_NOT_FOUND');
  }

  if (!user.twoFactorEnabled) {
    throw new HttpError(400, '2FA nao esta habilitado.', 'AUTH_2FA_NOT_ENABLED');
  }

  if (!user.passwordHash) {
    throw new HttpError(400, 'Nao foi possivel validar a senha.', 'AUTH_INVALID_PASSWORD');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    throw new HttpError(400, 'Senha invalida.', 'AUTH_INVALID_PASSWORD');
  }

  const codeValid = await verifyTwoFactorCode({ user, code });

  if (!codeValid) {
    throw new HttpError(400, 'Codigo 2FA invalido.', 'AUTH_INVALID_2FA_CODE');
  }

  await resetTwoFactorByUserId(userId);
};

const findUserByIdWithPassword = async (userId: number): Promise<UserRecord | null> => {
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        companyRole: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorSecretPending: true,
        twoFactorPendingCreatedAt: true,
        twoFactorConfirmedAt: true,
        passwordHash: true
      }
    });
  } catch (error) {
    return mapAuthReadError(error, 'findUserByIdWithPassword');
  }

  if (!user) {
    return null;
  }

  return attachCompanyContext(user);
};

const listTrustedDevices = async (userId: number): Promise<TrustedDeviceOutput[]> => {
  const now = new Date();
  const devices = await prisma.trustedDevice.findMany({
    where: {
      userId,
      expiresAt: {
        gt: now
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      userAgent: true,
      ip: true
    }
  });

  return devices.map((device) => ({
    id: device.id,
    createdAt: device.createdAt.toISOString(),
    expiresAt: device.expiresAt.toISOString(),
    lastUsedAt: device.lastUsedAt ? device.lastUsedAt.toISOString() : null,
    userAgent: device.userAgent,
    ip: device.ip
  }));
};

const revokeTrustedDevice = async (userId: number, deviceId: number): Promise<void> => {
  const result = await prisma.trustedDevice.deleteMany({
    where: {
      id: deviceId,
      userId
    }
  });

  if (result.count === 0) {
    throw new HttpError(404, 'Dispositivo confiavel nao encontrado.', 'AUTH_TRUSTED_DEVICE_NOT_FOUND');
  }
};

const adminResetTwoFactor = async (targetUserId: number): Promise<void> => {
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });

  if (!target) {
    throw new HttpError(404, 'Usuario nao encontrado.', 'AUTH_USER_NOT_FOUND');
  }

  await resetTwoFactorByUserId(targetUserId);
};

export {
  TRUSTED_DEVICE_COOKIE_NAME,
  adminResetTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  getUserById,
  listTrustedDevices,
  login,
  loginWithTwoFactor,
  register,
  revokeTrustedDevice,
  setupTwoFactor
};
export type { AuthResponse, TwoFactorPendingResponse };
