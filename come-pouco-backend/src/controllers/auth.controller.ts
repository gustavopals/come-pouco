import { NextFunction, Request, Response } from 'express';

import env from '../config/env';
import { AUDIT_EVENTS } from '../constants/audit-events';
import type {
  ConfirmTwoFactorBody,
  DisableTwoFactorBody,
  ForgotPasswordBody,
  LoginBody,
  LoginTwoFactorBody,
  RegisterBody,
  ResetPasswordBody
} from '../schemas/auth.schema';
import { logEventFromRequest } from '../services/audit.service';
import * as authService from '../services/auth.service';
import HttpError from '../utils/httpError';

const trustedDeviceCookieOptions = {
  httpOnly: true,
  secure: env.appEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.trustedDeviceDays * 24 * 60 * 60 * 1000
};

const ensureAuthenticatedUserId = (req: Request): number => {
  if (!req.userId) {
    throw new HttpError(401, 'Token nao informado.', 'AUTH_TOKEN_MISSING');
  }

  return req.userId;
};

const normalizeIdentifierForAudit = (identifier: string | undefined): string | null => {
  if (!identifier) {
    return null;
  }

  const normalized = identifier.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

const getErrorAuditMetadata = (error: unknown) => {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      errorCode: error.errorCode ?? null
    };
  }

  return {
    errorName: error instanceof Error ? error.name : 'UnknownError'
  };
};

const login = async (
  req: Request<Record<string, never>, unknown, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    const response = await authService.login({
      identifier,
      password,
      cookieHeader: req.headers.cookie
    });

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS,
      userId: 'user' in response ? response.user.id : null,
      success: true,
      metadata: {
        identifier: normalizeIdentifierForAudit(identifier),
        twoFactorRequired: 'twoFactorRequired' in response || 'requires2fa' in response
      }
    });

    res.status(200).json(response);
  } catch (error) {
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_LOGIN_FAIL,
      success: false,
      metadata: {
        identifier: normalizeIdentifierForAudit(req.body.identifier),
        ...getErrorAuditMetadata(error)
      }
    });
    next(error);
  }
};

const loginTwoFactor = async (
  req: Request<Record<string, never>, unknown, LoginTwoFactorBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tempToken, challengeId, code, trustDevice } = req.body;
    const effectiveTempToken = tempToken || challengeId;

    const response = await authService.loginWithTwoFactor({
      tempToken: effectiveTempToken!,
      code,
      trustDevice: Boolean(trustDevice),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    if (response.trustedDeviceToken) {
      res.cookie(
        authService.TRUSTED_DEVICE_COOKIE_NAME,
        response.trustedDeviceToken,
        trustedDeviceCookieOptions
      );
    }

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_LOGIN_2FA_SUCCESS,
      userId: response.user.id,
      success: true,
      metadata: {
        trustDevice: Boolean(trustDevice)
      }
    });

    res.status(200).json({ token: response.token, user: response.user });
  } catch (error) {
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_LOGIN_2FA_FAIL,
      success: false,
      metadata: {
        trustDevice: Boolean(req.body.trustDevice),
        ...getErrorAuditMetadata(error)
      }
    });
    next(error);
  }
};

const register = async (
  req: Request<Record<string, never>, unknown, RegisterBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAuthenticatedUserId(req);

    if (req.userRole !== 'ADMIN') {
      throw new HttpError(
        403,
        'Somente ADMIN pode registrar usuarios por este endpoint.',
        'AUTH_FORBIDDEN'
      );
    }

    const { fullName, username, email, password } = req.body;

    const response = await authService.register({ fullName, username, email, password });
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_USER_CREATE,
      entityType: 'USER',
      entityId: response.user.id,
      metadata: {
        username: response.user.username,
        role: response.user.role
      }
    });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (
  req: Request<Record<string, never>, unknown, ForgotPasswordBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authService.forgotPassword({ email: req.body.email, requesterIp: req.ip });
    res.status(200).json({ message: 'Se o e-mail estiver cadastrado, enviaremos instrucoes.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (
  req: Request<Record<string, never>, unknown, ResetPasswordBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const result = await authService.resetPassword({ token, newPassword });
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_PASSWORD_RESET,
      userId: result.userId,
      entityType: 'USER',
      entityId: result.userId
    });
    res.status(200).json({ message: 'Senha redefinida com sucesso.' });
  } catch (error) {
    next(error);
  }
};

const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.getUserById(ensureAuthenticatedUserId(req));

    if (!user) {
      throw new HttpError(404, 'Usuario nao encontrado.', 'AUTH_USER_NOT_FOUND');
    }

    res.status(200).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyRole: user.companyRole,
        company: user.company,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorConfirmedAt: user.twoFactorConfirmedAt
          ? user.twoFactorConfirmedAt.toISOString()
          : null
      }
    });
  } catch (error) {
    next(error);
  }
};

const setupTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await authService.setupTwoFactor(ensureAuthenticatedUserId(req));
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

const confirmTwoFactor = async (
  req: Request<Record<string, never>, unknown, ConfirmTwoFactorBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const response = await authService.confirmTwoFactor(
      ensureAuthenticatedUserId(req),
      req.body.code
    );
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_2FA_SETUP,
      entityType: 'USER',
      entityId: req.userId
    });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

const disableTwoFactor = async (
  req: Request<Record<string, never>, unknown, DisableTwoFactorBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { password, code } = req.body;

    await authService.disableTwoFactor({ userId: ensureAuthenticatedUserId(req), password, code });
    res.clearCookie(authService.TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceCookieOptions);
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_2FA_DISABLE,
      entityType: 'USER',
      entityId: req.userId
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

const listTrustedDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const devices = await authService.listTrustedDevices(ensureAuthenticatedUserId(req));
    res.status(200).json({ devices });
  } catch (error) {
    next(error);
  }
};

const revokeTrustedDevice = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const deviceId = Number(req.params.id);
    await authService.revokeTrustedDevice(ensureAuthenticatedUserId(req), deviceId);

    res.clearCookie(authService.TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceCookieOptions);
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.AUTH_TRUSTED_DEVICE_REVOKE,
      entityType: 'TRUSTED_DEVICE',
      entityId: deviceId
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const adminResetTwoFactor = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetUserId = Number(req.params.id);
    await authService.adminResetTwoFactor(targetUserId);
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_RESET_2FA,
      entityType: 'USER',
      entityId: targetUserId
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export {
  adminResetTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  forgotPassword,
  listTrustedDevices,
  login,
  loginTwoFactor,
  me,
  resetPassword,
  register,
  revokeTrustedDevice,
  setupTwoFactor
};
