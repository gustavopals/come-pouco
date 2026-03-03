import { NextFunction, Request, Response } from 'express';

import env from '../config/env';
import * as authService from '../services/auth.service';
import HttpError from '../utils/httpError';

interface LoginBody {
  identifier?: string;
  password?: string;
}

interface LoginTwoFactorBody {
  tempToken?: string;
  challengeId?: string;
  code?: string;
  trustDevice?: boolean;
}

interface RegisterBody {
  fullName?: string;
  username?: string;
  email?: string;
  password?: string;
}

interface ConfirmTwoFactorBody {
  code?: string;
}

interface DisableTwoFactorBody {
  password?: string;
  code?: string;
}

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

const parsePositiveId = (idRaw: string): number => {
  const id = Number(idRaw);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID invalido.');
  }

  return id;
};

const login = async (
  req: Request<Record<string, never>, unknown, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      throw new HttpError(400, 'Usuario/e-mail e senha sao obrigatorios.', 'AUTH_INVALID_REQUEST');
    }

    const response = await authService.login({
      identifier,
      password,
      cookieHeader: req.headers.cookie
    });

    res.status(200).json(response);
  } catch (error) {
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

    if (!effectiveTempToken || !code) {
      throw new HttpError(400, 'tempToken/challengeId e code sao obrigatorios.', 'AUTH_INVALID_REQUEST');
    }

    const response = await authService.loginWithTwoFactor({
      tempToken: effectiveTempToken,
      code,
      trustDevice: Boolean(trustDevice),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    if (response.trustedDeviceToken) {
      res.cookie(authService.TRUSTED_DEVICE_COOKIE_NAME, response.trustedDeviceToken, trustedDeviceCookieOptions);
    }

    res.status(200).json({ token: response.token, user: response.user });
  } catch (error) {
    next(error);
  }
};

const register = async (
  req: Request<Record<string, never>, unknown, RegisterBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName || !username || !password) {
      throw new HttpError(400, 'Nome, username e senha sao obrigatorios.', 'AUTH_INVALID_REQUEST');
    }

    if (String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.', 'AUTH_INVALID_PASSWORD');
    }

    const response = await authService.register({ fullName, username, email, password });
    res.status(201).json(response);
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
        twoFactorConfirmedAt: user.twoFactorConfirmedAt ? user.twoFactorConfirmedAt.toISOString() : null
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
    if (!req.body.code) {
      throw new HttpError(400, 'Codigo e obrigatorio.', 'AUTH_INVALID_REQUEST');
    }

    const response = await authService.confirmTwoFactor(ensureAuthenticatedUserId(req), req.body.code);
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

    if (!password || !code) {
      throw new HttpError(400, 'Senha e codigo sao obrigatorios.', 'AUTH_INVALID_REQUEST');
    }

    await authService.disableTwoFactor({ userId: ensureAuthenticatedUserId(req), password, code });
    res.clearCookie(authService.TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceCookieOptions);
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

const listTrustedDevices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const devices = await authService.listTrustedDevices(ensureAuthenticatedUserId(req));
    res.status(200).json({ devices });
  } catch (error) {
    next(error);
  }
};

const revokeTrustedDevice = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deviceId = parsePositiveId(req.params.id);
    await authService.revokeTrustedDevice(ensureAuthenticatedUserId(req), deviceId);

    res.clearCookie(authService.TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceCookieOptions);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const adminResetTwoFactor = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = parsePositiveId(req.params.id);
    await authService.adminResetTwoFactor(targetUserId);
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export {
  adminResetTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  listTrustedDevices,
  login,
  loginTwoFactor,
  me,
  register,
  revokeTrustedDevice,
  setupTwoFactor
};
