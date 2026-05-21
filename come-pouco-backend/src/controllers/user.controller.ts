import { NextFunction, Request, Response } from 'express';

import { AUDIT_EVENTS } from '../constants/audit-events';
import type { CreateUserBody, UpdateUserBody, UserQuery } from '../schemas/users.schema';
import { logEventFromRequest } from '../services/audit.service';
import * as userService from '../services/user.service';
import HttpError from '../utils/httpError';

const ensureAuthContext = (req: Request): void => {
  if (!req.userId || !req.userRole) {
    throw new HttpError(401, 'Token invalido ou expirado.');
  }
};

const toUserChangedFields = (body: UpdateUserBody): string[] =>
  Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => (key === 'password' ? 'passwordChanged' : key));

const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAuthContext(req);

    const query = req.query as unknown as UserQuery;
    const result = await userService.listUsers({
      requesterRole: req.userRole!,
      requesterCompanyId: req.companyId ?? null,
      requesterCompanyRole: req.companyRole ?? null,
      pagination: {
        page: query.page,
        limit: query.limit
      }
    });

    res
      .status(200)
      .json({ users: result.items, data: result.data, items: result.items, meta: result.meta });
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

    const { fullName, username, email, password, role, companyId, companyRole, publicSlug } =
      req.body;

    const user = await userService.createUser({
      fullName,
      username,
      email,
      password,
      role,
      companyId: role === 'ADMIN' ? null : companyId,
      companyRole: role === 'ADMIN' ? null : companyRole,
      publicSlug: role === 'ADMIN' ? null : publicSlug
    });

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_USER_CREATE,
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        username: user.username,
        role: user.role,
        companyId: user.companyId,
        companyRole: user.companyRole
      }
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

    const userId = Number(req.params.id);
    const target = await userService.getUserRecordById(userId);

    if (!target) {
      throw new HttpError(404, 'Usuario nao encontrado.');
    }

    const { fullName, username, email, password, role, companyId, companyRole, publicSlug } =
      req.body;

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
      role,
      companyId,
      companyRole,
      publicSlug
    });

    if (req.userRole === 'ADMIN') {
      logEventFromRequest(req, {
        eventType: AUDIT_EVENTS.ADMIN_USER_UPDATE,
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          changedFields: toUserChangedFields(req.body),
          role: user.role,
          companyId: user.companyId,
          companyRole: user.companyRole
        }
      });
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAuthContext(req);

    const userId = Number(req.params.id);
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
    if (req.userRole === 'ADMIN') {
      logEventFromRequest(req, {
        eventType: AUDIT_EVENTS.ADMIN_USER_DELETE,
        entityType: 'USER',
        entityId: userId,
        metadata: {
          username: target.username,
          role: target.role,
          companyId: target.companyId
        }
      });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createUser, deleteUser, listUsers, updateUser };
