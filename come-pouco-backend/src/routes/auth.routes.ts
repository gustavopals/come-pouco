import { Router } from 'express';

import * as authController from '../controllers/auth.controller';
import authMiddleware from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/register', authController.register);
authRouter.get('/me', authMiddleware, authController.me);

export default authRouter;
