const authService = require('../services/auth.service');
const HttpError = require('../utils/httpError');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new HttpError(400, 'E-mail e senha são obrigatórios.');
    }

    const response = await authService.login({ email, password });
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.userId);

    if (!user) {
      throw new HttpError(404, 'Usuário não encontrado.');
    }

    res.status(200).json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  me
};
