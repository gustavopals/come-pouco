import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import prisma from '../config/prisma';
import type { CompanyRole } from '../types/company-role';
import type { UserRole } from '../types/user-role';
import HttpError from '../utils/httpError';

interface UserRecord {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

interface UserOutput {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

interface ListUsersScope {
  requesterRole: UserRole;
  requesterCompanyId: number | null;
  requesterCompanyRole: CompanyRole | null;
}

interface CreateUserInput {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  role: UserRole;
  companyId?: number | null;
  companyRole?: CompanyRole | null;
}

interface UpdateUserInput {
  fullName?: string;
  username?: string;
  email?: string | null;
  password?: string;
  role?: UserRole;
  companyId?: number | null;
  companyRole?: CompanyRole | null;
}

const toUserOutput = (user: UserRecord): UserOutput => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: user.role,
  companyId: user.companyId,
  companyRole: user.companyRole,
  twoFactorEnabled: user.twoFactorEnabled,
  createdAt: user.createdAt.toISOString()
});

const mapPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'Ja existe um usuario com este username ou e-mail.');
    }

    if (error.code === 'P2025') {
      throw new HttpError(404, 'Usuario nao encontrado.');
    }
  }

  throw error;
};

const normalizeUsername = (value: string): string => {
  const normalized = value.trim().toLowerCase();

  if (!normalized.length) {
    throw new HttpError(400, 'Username e obrigatorio.');
  }

  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new HttpError(400, 'Username invalido. Use apenas letras, numeros, _ ou -.');
  }

  return normalized;
};

const normalizeEmail = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

const userSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  role: true,
  companyId: true,
  companyRole: true,
  twoFactorEnabled: true,
  createdAt: true
} satisfies Prisma.UserSelect;

const getUserRecordById = async (id: number): Promise<UserRecord | null> => {
  return prisma.user.findUnique({ where: { id }, select: userSelect });
};

const listUsers = async (scope: ListUsersScope): Promise<UserOutput[]> => {
  if (scope.requesterRole === 'ADMIN') {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, select: userSelect });
    return users.map(toUserOutput);
  }

  if (scope.requesterCompanyRole === 'OWNER' && scope.requesterCompanyId) {
    const users = await prisma.user.findMany({
      where: { role: 'USER', companyId: scope.requesterCompanyId },
      orderBy: { id: 'asc' },
      select: userSelect
    });

    return users.map(toUserOutput);
  }

  throw new HttpError(403, 'Acesso negado para listar usuarios.');
};

const createUser = async ({ fullName, username, email, password, role, companyId, companyRole }: CreateUserInput): Promise<UserOutput> => {
  const safeFullName = fullName.trim();
  const safeUsername = normalizeUsername(username);
  const safeEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        fullName: safeFullName,
        username: safeUsername,
        email: safeEmail,
        passwordHash,
        role,
        companyId: companyId ?? null,
        companyRole: role === 'ADMIN' ? null : companyRole ?? 'EMPLOYEE'
      },
      select: userSelect
    });

    return toUserOutput(user);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const updateUser = async (userId: number, data: UpdateUserInput): Promise<UserOutput> => {
  const updateData: Prisma.UserUncheckedUpdateInput = {};

  if (data.fullName !== undefined) {
    updateData.fullName = data.fullName.trim();
  }

  if (data.username !== undefined) {
    updateData.username = normalizeUsername(data.username);
  }

  if (data.email !== undefined) {
    updateData.email = normalizeEmail(data.email);
  }

  if (data.role !== undefined) {
    updateData.role = data.role;

    if (data.role === 'ADMIN') {
      updateData.companyId = null;
      updateData.companyRole = null;
    }
  }

  if (data.companyId !== undefined) {
    updateData.companyId = data.companyId;
  }

  if (data.companyRole !== undefined) {
    updateData.companyRole = data.companyRole;
  }

  if (data.password !== undefined && data.password !== '') {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualizacao.');
  }

  try {
    const user = await prisma.user.update({ where: { id: userId }, data: updateData, select: userSelect });
    return toUserOutput(user);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const deleteUser = async (userId: number): Promise<void> => {
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    return mapPrismaError(error);
  }
};

export { createUser, deleteUser, getUserRecordById, listUsers, updateUser };
export type { UserOutput };