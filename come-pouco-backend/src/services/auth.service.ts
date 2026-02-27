import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import env from '../config/env';
import prisma from '../config/prisma';
import HttpError from '../utils/httpError';

interface UserRecord {
  id: number;
  fullName: string;
  email: string;
  passwordHash?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
}

const buildAuthResponse = (user: UserRecord): AuthResponse => {
  const token = jwt.sign({ sub: user.id, email: user.email }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn
  });

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email
    }
  };
};

const findUserByEmail = async (email: string): Promise<UserRecord | null> => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true
    }
  });

  return user;
};

const login = async ({ email, password }: LoginInput): Promise<AuthResponse> => {
  const user = await findUserByEmail(email.trim().toLowerCase());

  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  return buildAuthResponse(user);
};

const register = async ({ fullName, email, password }: RegisterInput): Promise<AuthResponse> => {
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
        email: true
      }
    });

    return buildAuthResponse(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'Já existe um usuário com este e-mail.');
    }

    throw error;
  }
};

const getUserById = async (userId: number): Promise<UserRecord | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true
    }
  });

  return user;
};

export { login, register, getUserById };
