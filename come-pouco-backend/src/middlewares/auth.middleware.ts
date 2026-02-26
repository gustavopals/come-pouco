import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import env from '../config/env';
import HttpError from '../utils/httpError';

const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
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

    const userId = Number((decoded as JwtPayload).sub);

    if (Number.isNaN(userId)) {
      throw new HttpError(401, 'Token inválido ou expirado.');
    }

    req.userId = userId;
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
