import { NextFunction, Request, Response } from 'express';

import type { UserRole } from '../types/user-role';
import HttpError from '../utils/httpError';

const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      return next(new HttpError(401, 'Token inválido ou expirado.'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(new HttpError(403, 'Acesso negado para este perfil.'));
    }

    return next();
  };
};

export default requireRole;
