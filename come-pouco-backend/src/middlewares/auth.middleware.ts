import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import env from '../config/env';
import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new HttpError(401, 'Token não informado.');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Formato de token inválido.');
    }

    const decoded = jwt.verify(token, env.jwt.secret);

    if (typeof decoded === 'string' || !(decoded as JwtPayload).sub) {
      throw new HttpError(401, 'Token inválido ou expirado.');
    }

    const payload = decoded as JwtPayload;
    const userId = Number(payload.sub);

    if (Number.isNaN(userId)) {
      throw new HttpError(401, 'Token inválido ou expirado.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      throw new HttpError(401, 'Token inválido ou expirado.');
    }

    req.userId = userId;
    req.userRole = user.role;
    next();
  } catch (error) {
    const authError = error as { name?: string };

    if (authError.name === 'JsonWebTokenError' || authError.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Token inválido ou expirado.'));
    }

    return next(error);
  }
};

export default authMiddleware;
