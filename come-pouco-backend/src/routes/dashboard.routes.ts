import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

router.get('/production-summary', dashboardController.getProductionSummary);

export default router;
