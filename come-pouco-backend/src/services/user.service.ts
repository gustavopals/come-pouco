import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

interface UserRecord {
  id: number;
  fullName: string;
  email: string;
  createdAt: Date;
}

interface UserOutput {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
}

interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
}

interface UpdateUserInput {
  fullName?: string;
  email?: string;
  password?: string;
}

const toUserOutput = (user: UserRecord): UserOutput => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  createdAt: user.createdAt.toISOString()
});

const mapPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'Já existe um usuário com este e-mail.');
    }

    if (error.code === 'P2025') {
      throw new HttpError(404, 'Usuário não encontrado.');
    }
  }

  throw error;
};

const listUsers = async (): Promise<UserOutput[]> => {
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      createdAt: true
    }
  });

  return users.map(toUserOutput);
};

const createUser = async ({ fullName, email, password }: CreateUserInput): Promise<UserOutput> => {
  const safeFullName = fullName.trim();
  const safeEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        fullName: safeFullName,
        email: safeEmail,
        passwordHash
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true
      }
    });

    return toUserOutput(user);
  } catch (error) {
    return mapPrismaError(error);
  }
};

const updateUser = async (userId: number, data: UpdateUserInput): Promise<UserOutput> => {
  const updateData: Prisma.UserUpdateInput = {};

  if (data.fullName !== undefined) {
    updateData.fullName = data.fullName.trim();
  }

  if (data.email !== undefined) {
    updateData.email = data.email.trim().toLowerCase();
  }

  if (data.password !== undefined && data.password !== '') {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  if (!Object.keys(updateData).length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualização.');
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true
      }
    });

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

export { createUser, deleteUser, listUsers, updateUser };
