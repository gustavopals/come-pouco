import { Router } from 'express';

import * as adminApiUsageController from '../controllers/admin-api-usage.controller';
import * as adminEmailConfigController from '../controllers/admin-email-config.controller';
import * as authController from '../controllers/auth.controller';

const adminRouter = Router();

adminRouter.get('/api-usage', adminApiUsageController.getApiUsage);
adminRouter.delete('/api-usage/mock', adminApiUsageController.deleteMockApiUsage);
adminRouter.post('/users/:id/reset-2fa', authController.adminResetTwoFactor);
adminRouter.get('/email-config', adminEmailConfigController.getSystemEmailConfig);
adminRouter.put('/email-config', adminEmailConfigController.updateSystemEmailConfig);
adminRouter.post('/email-config/test', adminEmailConfigController.testSystemEmailConfig);

export default adminRouter;
