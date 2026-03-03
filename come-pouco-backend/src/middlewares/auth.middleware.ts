import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import env from '../config/env';
import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

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

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, companyId: true, companyRole: true }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2022' || error.code === 'P2021')) {
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

    if (!user) {
      throw new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_INVALID');
    }

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