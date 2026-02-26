import { Router } from 'express';

import authMiddleware from '../middlewares/auth.middleware';
import affiliateLinkRouter from './affiliate-link.routes';
import authRouter from './auth.routes';
import userRouter from './user.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/affiliate-links', authMiddleware, affiliateLinkRouter);

export default router;
