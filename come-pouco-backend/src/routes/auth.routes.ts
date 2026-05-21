import { Router } from 'express';

import * as authController from '../controllers/auth.controller';
import authMiddleware from '../middlewares/auth.middleware';
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  loginTwoFactorRateLimiter
} from '../middlewares/rate-limit.middleware';
import {
  confirmTwoFactorBodySchema,
  disableTwoFactorBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  loginTwoFactorBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  trustedDeviceParamsSchema
} from '../schemas/auth.schema';
import { validate } from '../utils/validate';

const authRouter = Router();

authRouter.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginBodySchema }),
  authController.login
);
authRouter.post(
  '/login/2fa',
  loginTwoFactorRateLimiter,
  validate({ body: loginTwoFactorBodySchema }),
  authController.loginTwoFactor
);
authRouter.post(
  '/2fa/verify',
  loginTwoFactorRateLimiter,
  validate({ body: loginTwoFactorBodySchema }),
  authController.loginTwoFactor
);
authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validate({ body: forgotPasswordBodySchema }),
  authController.forgotPassword
);
authRouter.post(
  '/reset-password',
  validate({ body: resetPasswordBodySchema }),
  authController.resetPassword
);
authRouter.post(
  '/register',
  authMiddleware,
  validate({ body: registerBodySchema }),
  authController.register
);
authRouter.get('/me', authMiddleware, authController.me);
authRouter.post('/2fa/setup', authMiddleware, authController.setupTwoFactor);
authRouter.post(
  '/2fa/confirm',
  authMiddleware,
  validate({ body: confirmTwoFactorBodySchema }),
  authController.confirmTwoFactor
);
authRouter.post(
  '/2fa/enable',
  authMiddleware,
  validate({ body: confirmTwoFactorBodySchema }),
  authController.confirmTwoFactor
);
authRouter.post(
  '/2fa/disable',
  authMiddleware,
  validate({ body: disableTwoFactorBodySchema }),
  authController.disableTwoFactor
);
authRouter.get('/trusted-devices', authMiddleware, authController.listTrustedDevices);
authRouter.delete(
  '/trusted-devices/:id',
  authMiddleware,
  validate({ params: trustedDeviceParamsSchema }),
  authController.revokeTrustedDevice
);

export default authRouter;
