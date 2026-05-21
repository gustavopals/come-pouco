import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import {
  conversionDashboardQuerySchema,
  conversionTimelineQuerySchema,
  conversionTopProductsQuerySchema
} from '../schemas/dashboard.schema';
import { validate } from '../utils/validate';

const router = Router();

router.get('/production-summary', dashboardController.getProductionSummary);
router.get(
  '/conversions/summary',
  validate({ query: conversionDashboardQuerySchema }),
  dashboardController.getConversionSummary
);
router.get(
  '/conversions/top-products',
  validate({ query: conversionTopProductsQuerySchema }),
  dashboardController.getConversionTopProducts
);
router.get(
  '/conversions/by-employee',
  validate({ query: conversionDashboardQuerySchema }),
  dashboardController.getConversionsByEmployee
);
router.get(
  '/conversions/timeline',
  validate({ query: conversionTimelineQuerySchema }),
  dashboardController.getConversionTimeline
);

export default router;
