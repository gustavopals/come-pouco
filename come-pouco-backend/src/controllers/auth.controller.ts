import { NextFunction, Request, Response } from 'express';

import * as authService from '../services/auth.service';
import HttpError from '../utils/httpError';

interface LoginBody {
  email?: string;
  password?: string;
}

interface RegisterBody {
  fullName?: string;
  email?: string;
  password?: string;
}

const login = async (
  req: Request<Record<string, never>, unknown, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new HttpError(400, 'E-mail e senha são obrigatórios.');
    }

    const response = await authService.login({ email, password });
    res.status(200).json(response);
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
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      throw new HttpError(400, 'Nome, e-mail e senha são obrigatórios.');
    }

    if (String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no mínimo 6 caracteres.');
    }

    const response = await authService.register({ fullName, email, password });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new HttpError(401, 'Token não informado.');
    }

    const user = await authService.getUserById(req.userId);

    if (!user) {
      throw new HttpError(404, 'Usuário não encontrado.');
    }

    res.status(200).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

export { login, register, me };
