import { Router } from 'express';

import authMiddleware from '../middlewares/auth.middleware';
import authRouter from './auth.routes';
import userRouter from './user.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);

export default router;
