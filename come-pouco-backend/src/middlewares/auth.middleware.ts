import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import env from '../config/env';
import prisma from '../config/prisma';
import { getCachedAuthUser, setCachedAuthUser } from '../services/auth-user-cache.service';
import HttpError from '../utils/httpError';

const isTokenIssuedBeforePasswordChange = (
  payload: JwtPayload,
  passwordChangedAt: Date | null
): boolean => {
  if (!passwordChangedAt) {
    return false;
  }

  const authIssuedAt = (payload as JwtPayload & { authIssuedAt?: unknown }).authIssuedAt;

  if (typeof authIssuedAt === 'number') {
    return authIssuedAt < passwordChangedAt.getTime();
  }

  if (typeof payload.iat !== 'number') {
    return true;
  }

  return payload.iat <= Math.floor(passwordChangedAt.getTime() / 1000);
};

const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new HttpError(401, 'Token nao informado.', 'AUTH_TOKEN_MISSING');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Formato de token invalido.', 'AUTH_TOKEN_INVALID');
    }

    const decoded = jwt.verify(token, env.jwt.secret);

    if (typeof decoded === 'string' || !(decoded as JwtPayload).sub) {
      throw new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_INVALID');
    }

    const payload = decoded as JwtPayload;
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      throw new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_INVALID');
    }

    let user = getCachedAuthUser(userId);

    if (!user) {
      try {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, companyId: true, companyRole: true, passwordChangedAt: true }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2022' || error.code === 'P2021')
        ) {
          return next(
            new HttpError(
              400,
              'Estrutura de autenticacao desatualizada. Execute as migracoes do banco.',
              'AUTH_SCHEMA_OUTDATED'
            )
          );
        }
        throw error;
      }
    }

    if (!user) {
      throw new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_INVALID');
    }

    if (isTokenIssuedBeforePasswordChange(payload, user.passwordChangedAt)) {
      throw new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_INVALID');
    }

    setCachedAuthUser(userId, {
      role: user.role === 'ADMIN' || user.role === 'USER' ? user.role : 'USER',
      companyId: user.companyId,
      companyRole: user.companyRole,
      passwordChangedAt: user.passwordChangedAt
    });

    req.userId = userId;
    req.userRole = user.role === 'ADMIN' || user.role === 'USER' ? user.role : 'USER';
    req.companyId = user.companyId;
    req.companyRole = user.companyRole;
    next();
  } catch (error) {
    const authError = error as { name?: string };

    if (authError.name === 'JsonWebTokenError') {
      return next(new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_INVALID'));
    }

    if (authError.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_EXPIRED'));
    }

    return next(error);
  }
};

export default authMiddleware;
