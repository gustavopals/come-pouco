import { NextFunction, Request, Response } from 'express';

import * as userService from '../services/user.service';
import { isCompanyRole } from '../types/company-role';
import { isUserRole } from '../types/user-role';
import HttpError from '../utils/httpError';

interface CreateUserBody {
  fullName?: string;
  username?: string;
  email?: string | null;
  password?: string;
  role?: string;
  companyId?: number;
  companyRole?: string;
}

interface CreateEmployeeBody {
  fullName?: string;
  username?: string;
  email?: string | null;
  password?: string;
}

interface UpdateUserBody {
  fullName?: string;
  username?: string;
  email?: string | null;
  password?: string;
  role?: string;
  companyId?: number | null;
  companyRole?: string | null;
}

const parseUserId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID de usuario invalido.');
  }

  return id;
};

const ensureAuthContext = (req: Request): void => {
  if (!req.userId || !req.userRole) {
    throw new HttpError(401, 'Token invalido ou expirado.');
  }
};

const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAuthContext(req);

    const users = await userService.listUsers({
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null
    });

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
    ensureAuthContext(req);

    if (req.userRole !== 'ADMIN') {
      throw new HttpError(403, 'Somente ADMIN pode criar usuarios gerais.');
    }

    const { fullName, username, email, password, role, companyId, companyRole } = req.body;

    if (!fullName || !username || !password) {
      throw new HttpError(400, 'Nome, username e senha sao obrigatorios.');
    }

    if (String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
    }

    const userRole = role ?? 'USER';

    if (!isUserRole(userRole)) {
      throw new HttpError(400, 'Perfil de usuario invalido.');
    }

    const normalizedCompanyRoleRaw = companyRole ?? 'EMPLOYEE';

    if (userRole === 'USER' && !isCompanyRole(normalizedCompanyRoleRaw)) {
      throw new HttpError(400, 'Perfil interno da empresa invalido.');
    }

    const normalizedCompanyRole: 'OWNER' | 'EMPLOYEE' | null =
      userRole === 'USER' ? (normalizedCompanyRoleRaw as 'OWNER' | 'EMPLOYEE') : null;

    if (userRole === 'USER' && (!companyId || companyId <= 0)) {
      throw new HttpError(400, 'companyId e obrigatorio para usuarios do tipo USER.');
    }

    const user = await userService.createUser({
      fullName,
      username,
      email,
      password,
      role: userRole,
      companyId: userRole === 'ADMIN' ? null : companyId,
      companyRole: userRole === 'ADMIN' ? null : normalizedCompanyRole
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const createEmployee = async (
  req: Request<Record<string, never>, unknown, CreateEmployeeBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAuthContext(req);

    if (req.userRole === 'ADMIN') {
      throw new HttpError(400, 'Use /users para criar funcionario como ADMIN informando a empresa.');
    }

    if (req.userRole !== 'USER' || req.companyRole !== 'OWNER' || !req.companyId) {
      throw new HttpError(403, 'Acesso negado para criar funcionario.');
    }

    const { fullName, username, email, password } = req.body;

    if (!fullName || !username || !password) {
      throw new HttpError(400, 'Nome, username e senha sao obrigatorios.');
    }

    if (String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
    }

    const user = await userService.createUser({
      fullName,
      username,
      email,
      password,
      role: 'USER',
      companyId: req.companyId,
      companyRole: 'EMPLOYEE'
    });

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
    ensureAuthContext(req);

    const userId = parseUserId(req.params.id);
    const target = await userService.getUserRecordById(userId);

    if (!target) {
      throw new HttpError(404, 'Usuario nao encontrado.');
    }

    const { fullName, username, email, password, role, companyId, companyRole } = req.body;

    if (password !== undefined && String(password).length > 0 && String(password).length < 6) {
      throw new HttpError(400, 'A senha deve ter no minimo 6 caracteres.');
    }

    if (role !== undefined && !isUserRole(role)) {
      throw new HttpError(400, 'Perfil de usuario invalido.');
    }

    if (companyRole !== undefined && companyRole !== null && !isCompanyRole(companyRole)) {
      throw new HttpError(400, 'Perfil interno da empresa invalido.');
    }

    if (req.userRole !== 'ADMIN') {
      if (req.companyRole !== 'OWNER' || !req.companyId) {
        throw new HttpError(403, 'Acesso negado para atualizar usuario.');
      }

      if (target.role !== 'USER' || target.companyId !== req.companyId) {
        throw new HttpError(403, 'Acesso negado para atualizar usuario.');
      }

      if (role && role !== 'USER') {
        throw new HttpError(403, 'OWNER nao pode alterar papel global do usuario.');
      }

      if (companyId !== undefined && companyId !== req.companyId) {
        throw new HttpError(403, 'OWNER nao pode trocar empresa do usuario.');
      }
    }

    const user = await userService.updateUser(userId, {
      fullName,
      username,
      email,
      password,
      role: role as 'ADMIN' | 'USER' | undefined,
      companyId,
      companyRole: companyRole as 'OWNER' | 'EMPLOYEE' | null | undefined
    });

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAuthContext(req);

    const userId = parseUserId(req.params.id);
    const target = await userService.getUserRecordById(userId);

    if (!target) {
      throw new HttpError(404, 'Usuario nao encontrado.');
    }

    if (req.userRole !== 'ADMIN') {
      if (req.companyRole !== 'OWNER' || !req.companyId) {
        throw new HttpError(403, 'Acesso negado para remover usuario.');
      }

      if (target.role !== 'USER' || target.companyId !== req.companyId) {
        throw new HttpError(403, 'Acesso negado para remover usuario.');
      }
    }

    await userService.deleteUser(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createEmployee, createUser, deleteUser, listUsers, updateUser };
