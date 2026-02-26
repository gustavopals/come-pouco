const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const env = require('../config/env');
const HttpError = require('../utils/httpError');

const buildAuthResponse = (user) => {
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

const findUserByEmail = async (email) => {
  const query = `
    SELECT id, full_name, email, password_hash
    FROM users
    WHERE email = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [email.toLowerCase()]);
  return result.rows[0] || null;
};

const login = async ({ email, password }) => {
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

const register = async ({ fullName, email, password }) => {
  const safeFullName = fullName.trim();
  const safeEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (full_name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, full_name, email
  `;

  try {
    const result = await pool.query(query, [safeFullName, safeEmail, passwordHash]);
    return buildAuthResponse(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'Já existe um usuário com este e-mail.');
    }

    throw error;
  }
};

const getUserById = async (userId) => {
  const query = `
    SELECT id, full_name, email
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

module.exports = {
  login,
  register,
  getUserById
};
