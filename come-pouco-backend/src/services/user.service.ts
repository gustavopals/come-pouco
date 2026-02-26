import bcrypt from 'bcryptjs';

import { pool } from '../config/db';
import HttpError from '../utils/httpError';

interface UserRow {
  id: number;
  full_name: string;
  email: string;
  created_at: Date | string;
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

const toISOString = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
};

const toUserOutput = (user: UserRow): UserOutput => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  createdAt: toISOString(user.created_at)
});

const mapDbError = (error: unknown): never => {
  const dbError = error as { code?: string };

  if (dbError.code === '23505') {
    throw new HttpError(409, 'Já existe um usuário com este e-mail.');
  }

  throw error;
};

const listUsers = async (): Promise<UserOutput[]> => {
  const query = `
    SELECT id, full_name, email, created_at
    FROM users
    ORDER BY id ASC
  `;

  const result = await pool.query<UserRow>(query);
  return result.rows.map(toUserOutput);
};

const createUser = async ({ fullName, email, password }: CreateUserInput): Promise<UserOutput> => {
  const safeFullName = fullName.trim();
  const safeEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (full_name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, full_name, email, created_at
  `;

  try {
    const result = await pool.query<UserRow>(query, [safeFullName, safeEmail, passwordHash]);
    return toUserOutput(result.rows[0]);
  } catch (error) {
    return mapDbError(error);
  }
};

const updateUser = async (userId: number, data: UpdateUserInput): Promise<UserOutput> => {
  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (data.fullName !== undefined) {
    updates.push(`full_name = $${updates.length + 1}`);
    values.push(data.fullName.trim());
  }

  if (data.email !== undefined) {
    updates.push(`email = $${updates.length + 1}`);
    values.push(data.email.trim().toLowerCase());
  }

  if (data.password !== undefined && data.password !== '') {
    const passwordHash = await bcrypt.hash(data.password, 10);
    updates.push(`password_hash = $${updates.length + 1}`);
    values.push(passwordHash);
  }

  if (!updates.length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualização.');
  }

  values.push(userId);

  const query = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = $${values.length}
    RETURNING id, full_name, email, created_at
  `;

  try {
    const result = await pool.query<UserRow>(query, values);

    if (!result.rows[0]) {
      throw new HttpError(404, 'Usuário não encontrado.');
    }

    return toUserOutput(result.rows[0]);
  } catch (error) {
    return mapDbError(error);
  }
};

const deleteUser = async (userId: number): Promise<void> => {
  const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);

  if (!result.rowCount) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }
};

export { createUser, deleteUser, listUsers, updateUser };
