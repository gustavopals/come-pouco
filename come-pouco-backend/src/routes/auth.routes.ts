import { Router } from 'express';

import * as authController from '../controllers/auth.controller';
import authMiddleware from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/login/2fa', authController.loginTwoFactor);
authRouter.post('/2fa/verify', authController.loginTwoFactor);
authRouter.post('/register', authController.register);
authRouter.post('/forgot-password', authController.forgotPassword);
authRouter.post('/reset-password', authController.resetPassword);
authRouter.get('/me', authMiddleware, authController.me);
authRouter.post('/2fa/setup', authMiddleware, authController.setupTwoFactor);
authRouter.post('/2fa/confirm', authMiddleware, authController.confirmTwoFactor);
authRouter.post('/2fa/enable', authMiddleware, authController.confirmTwoFactor);
authRouter.post('/2fa/disable', authMiddleware, authController.disableTwoFactor);
authRouter.get('/trusted-devices', authMiddleware, authController.listTrustedDevices);
authRouter.delete('/trusted-devices/:id', authMiddleware, authController.revokeTrustedDevice);

export default authRouter;
