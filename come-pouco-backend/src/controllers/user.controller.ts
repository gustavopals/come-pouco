import { NextFunction, Request, Response } from 'express';

import * as userService from '../services/user.service';
import { isUserRole } from '../types/user-role';
import HttpError from '../utils/httpError';

interface CreateUserBody {
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
}

interface UpdateUserBody {
  fullName?: string;
  email?: string;
  password?: string;
  role?: string;
}

const parseUserId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID de usuário inválido.');
  }

  return id;
};

const listUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await userService.listUsers();
    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

const createUser = async (
  req: Request<Record<string, never>, unknown, CreateUserBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      throw new HttpError(400, 'Nome, e-mail e senha são obrigatórios.');
    }

    if (String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no mínimo 6 caracteres.');
    }

    const userRole = role ?? 'USER';

    if (!isUserRole(userRole)) {
      throw new HttpError(400, 'Perfil de usuário inválido.');
    }

    const user = await userService.createUser({ fullName, email, password, role: userRole });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (
  req: Request<{ id: string }, unknown, UpdateUserBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = parseUserId(req.params.id);
    const { fullName, email, password, role } = req.body;

    if (password !== undefined && String(password).length > 0 && String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no mínimo 6 caracteres.');
    }

    if (role !== undefined && !isUserRole(role)) {
      throw new HttpError(400, 'Perfil de usuário inválido.');
    }

    const user = await userService.updateUser(userId, { fullName, email, password, role });
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = parseUserId(req.params.id);
    await userService.deleteUser(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createUser, deleteUser, listUsers, updateUser };
