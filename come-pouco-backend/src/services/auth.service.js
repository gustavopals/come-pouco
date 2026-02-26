const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const env = require('../config/env');
const HttpError = require('../utils/httpError');

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
  const user = await findUserByEmail(email);

  if (!user) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

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
  getUserById
};
