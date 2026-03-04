import { Router } from 'express';

import authMiddleware from '../middlewares/auth.middleware';
import requireRole from '../middlewares/role.middleware';
import adminRouter from './admin.routes';
import affiliateLinkRouter from './affiliate-link.routes';
import authRouter from './auth.routes';
import integrationRouter from './integration.routes';
import purchasePlatformRouter from './purchase-platform.routes';
import companyRouter from './company.routes';
import userRouter from './user.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/companies', authMiddleware, requireRole('ADMIN'), companyRouter);
router.use('/affiliate-links', authMiddleware, affiliateLinkRouter);
router.use('/purchase-platforms', authMiddleware, purchasePlatformRouter);
router.use('/integrations', authMiddleware, integrationRouter);
router.use('/admin', authMiddleware, requireRole('ADMIN'), adminRouter);

export default router;
