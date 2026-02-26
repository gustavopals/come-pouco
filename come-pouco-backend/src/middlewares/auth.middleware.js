const jwt = require('jsonwebtoken');
const env = require('../config/env');
const HttpError = require('../utils/httpError');

const authMiddleware = (req, _res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new HttpError(401, 'Token não informado.');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Formato de token inválido.');
    }

    const decoded = jwt.verify(token, env.jwt.secret);
    req.userId = Number(decoded.sub);

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Token inválido ou expirado.'));
    }

    return next(error);
  }
};

module.exports = authMiddleware;
