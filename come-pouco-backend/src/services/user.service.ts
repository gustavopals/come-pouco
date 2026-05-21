import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import prisma from '../config/prisma';
import { invalidateAuthUserCache } from './auth-user-cache.service';
import type { CompanyRole } from '../types/company-role';
import type { UserRole } from '../types/user-role';
import HttpError from '../utils/httpError';
import {
  PaginatedResult,
  PaginationInput,
  normalizePagination,
  toPaginatedResult
} from '../utils/pagination';
import { normalizePublicSlugInput } from './public-slug.service';

interface UserRecord {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  companyId: number | null;
  companyRole: CompanyRole | null;
  publicSlug: string | null;
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
  publicSlug: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

interface ListUsersScope {
  requesterRole: UserRole;
  requesterCompanyId: number | null;
  requesterCompanyRole: CompanyRole | null;
  pagination?: PaginationInput;
}

interface CreateUserInput {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  role: UserRole;
  companyId?: number | null;
  companyRole?: CompanyRole | null;
  publicSlug?: string | null;
}

interface UpdateUserInput {
  fullName?: string;
  username?: string;
  email?: string | null;
  password?: string;
  role?: UserRole;
  companyId?: number | null;
  companyRole?: CompanyRole | null;
  publicSlug?: string | null;
}

const toUserOutput = (user: UserRecord): UserOutput => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: user.role,
  companyId: user.companyId,
  companyRole: user.companyRole,
  publicSlug: user.publicSlug,
  twoFactorEnabled: user.twoFactorEnabled,
  createdAt: user.createdAt.toISOString()
});

const mapPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';
      if (target.includes('public_slug')) {
        throw new HttpError(409, 'Ja existe um usuario com esse slug publico nesta empresa.');
      }

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
  publicSlug: true,
  twoFactorEnabled: true,
  createdAt: true
} satisfies Prisma.UserSelect;

const getUserRecordById = async (id: number): Promise<UserRecord | null> => {
  return prisma.user.findUnique({ where: { id }, select: userSelect });
};

const listUsers = async (scope: ListUsersScope): Promise<PaginatedResult<UserOutput>> => {
  const pagination = normalizePagination(scope.pagination);

  if (scope.requesterRole === 'ADMIN') {
    const [total, users] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.findMany({
        orderBy: { id: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        select: userSelect
      })
    ]);
    return toPaginatedResult(users.map(toUserOutput), total, pagination);
  }

  if (scope.requesterCompanyRole === 'OWNER' && scope.requesterCompanyId) {
    const where = { role: 'USER' as const, companyId: scope.requesterCompanyId };
    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        select: userSelect
      })
    ]);

    return toPaginatedResult(users.map(toUserOutput), total, pagination);
  }

  throw new HttpError(403, 'Acesso negado para listar usuarios.');
};

const createUser = async ({
  fullName,
  username,
  email,
  password,
  role,
  companyId,
  companyRole,
  publicSlug
}: CreateUserInput): Promise<UserOutput> => {
  const safeFullName = fullName.trim();
  const safeUsername = normalizeUsername(username);
  const safeEmail = normalizeEmail(email);
  const normalizedPublicSlug =
    role === 'ADMIN' ? null : normalizePublicSlugInput(publicSlug, { nullable: true });
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
        companyRole: role === 'ADMIN' ? null : (companyRole ?? 'EMPLOYEE'),
        publicSlug: normalizedPublicSlug
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

  if (data.publicSlug !== undefined) {
    updateData.publicSlug = normalizePublicSlugInput(data.publicSlug, { nullable: true });
  }

  if (data.role === 'ADMIN') {
    updateData.publicSlug = null;
  }

  if (data.password !== undefined && data.password !== '') {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
    updateData.passwordChangedAt = new Date();
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualizacao.');
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: userSelect
    });
    invalidateAuthUserCache(userId);
    return toUserOutput(user);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const deleteUser = async (userId: number): Promise<void> => {
  try {
    await prisma.user.delete({ where: { id: userId } });
    invalidateAuthUserCache(userId);
  } catch (error) {
    return mapPrismaError(error);
  }
};

export { createUser, deleteUser, getUserRecordById, listUsers, updateUser };
export type { UserOutput };
