import { Router } from 'express';

import authMiddleware from '../middlewares/auth.middleware';
import requireRole from '../middlewares/role.middleware';
import adminRouter from './admin.routes';
import affiliateLinkRouter from './affiliate-link.routes';
import authRouter from './auth.routes';
import dashboardRouter from './dashboard.routes';
import * as healthController from '../controllers/health.controller';
import integrationRouter from './integration.routes';
import * as metricsController from '../controllers/metrics.controller';
import { metricsAuthMiddleware } from '../middlewares/metrics-auth.middleware';
import publicRouter from './public.routes';
import purchasePlatformRouter from './purchase-platform.routes';
import companyRouter from './company.routes';
import userRouter from './user.routes';

const router = Router();

router.get('/health', healthController.getHealth);
router.get('/health/ready', healthController.getReady);
router.get('/metrics', metricsAuthMiddleware, metricsController.getPrometheusMetrics);

router.use('/auth', authRouter);
router.use('/public', publicRouter);
router.use('/dashboard', authMiddleware, dashboardRouter);
router.use('/users', authMiddleware, userRouter);
router.use('/companies', authMiddleware, companyRouter);
router.use('/affiliate-links', authMiddleware, affiliateLinkRouter);
router.use('/purchase-platforms', authMiddleware, purchasePlatformRouter);
router.use('/integrations', authMiddleware, integrationRouter);
router.use('/admin', authMiddleware, requireRole('ADMIN'), adminRouter);

export default router;
