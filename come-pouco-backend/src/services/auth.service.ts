import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { pool } from '../config/db';
import env from '../config/env';
import HttpError from '../utils/httpError';

interface UserRow {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
}

interface UserPublicRow {
  id: number;
  full_name: string;
  email: string;
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

const buildAuthResponse = (user: UserPublicRow): AuthResponse => {
  const token = jwt.sign({ sub: user.id, email: user.email }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn
  });

  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email
    }
  };
};

const findUserByEmail = async (email: string): Promise<UserRow | null> => {
  const query = `
    SELECT id, full_name, email, password_hash
    FROM users
    WHERE email = $1
    LIMIT 1
  `;

  const result = await pool.query<UserRow>(query, [email.toLowerCase()]);
  return result.rows[0] || null;
};

const login = async ({ email, password }: LoginInput): Promise<AuthResponse> => {
  const user = await findUserByEmail(email.trim().toLowerCase());

  if (!user) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  return buildAuthResponse(user);
};

const register = async ({ fullName, email, password }: RegisterInput): Promise<AuthResponse> => {
  const safeFullName = fullName.trim();
  const safeEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (full_name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, full_name, email
  `;

  try {
    const result = await pool.query<UserPublicRow>(query, [safeFullName, safeEmail, passwordHash]);
    return buildAuthResponse(result.rows[0]);
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === '23505') {
      throw new HttpError(409, 'Já existe um usuário com este e-mail.');
    }

    throw error;
  }
};

const getUserById = async (userId: number): Promise<UserPublicRow | null> => {
  const query = `
    SELECT id, full_name, email
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query<UserPublicRow>(query, [userId]);
  return result.rows[0] || null;
};

export { login, register, getUserById };
