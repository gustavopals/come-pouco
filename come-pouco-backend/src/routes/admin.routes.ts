import { Router } from 'express';

import * as adminAuditLogController from '../controllers/admin-audit-log.controller';
import * as adminApiUsageController from '../controllers/admin-api-usage.controller';
import * as adminCacheController from '../controllers/admin-cache.controller';
import * as adminEmailConfigController from '../controllers/admin-email-config.controller';
import * as adminIncidentController from '../controllers/admin-incident.controller';
import * as adminPublicModuleController from '../controllers/admin-public-module.controller';
import * as authController from '../controllers/auth.controller';
import {
  apiUsageQuerySchema,
  auditLogQuerySchema,
  conversionAnonymizeQuerySchema,
  createIncidentBodySchema,
  deleteMockApiUsageQuerySchema,
  incidentIdParamsSchema,
  incidentQuerySchema,
  updateEmailConfigBodySchema,
  updateIncidentBodySchema
} from '../schemas/admin.schema';
import { adminResetTwoFactorParamsSchema } from '../schemas/auth.schema';
import { validate } from '../utils/validate';

const adminRouter = Router();

adminRouter.get(
  '/audit-logs',
  validate({ query: auditLogQuerySchema }),
  adminAuditLogController.listAuditLogs
);
adminRouter.get(
  '/api-usage',
  validate({ query: apiUsageQuerySchema }),
  adminApiUsageController.getApiUsage
);
adminRouter.delete(
  '/api-usage/mock',
  validate({ query: deleteMockApiUsageQuerySchema }),
  adminApiUsageController.deleteMockApiUsage
);
adminRouter.get('/cache-stats', adminCacheController.getCacheStats);
adminRouter.get('/metrics/public-module', adminPublicModuleController.getPublicModuleMetrics);
adminRouter.delete(
  '/conversions/anonymize',
  validate({ query: conversionAnonymizeQuerySchema }),
  adminPublicModuleController.anonymizeConversions
);
adminRouter.get('/status', adminIncidentController.getStatus);
adminRouter.get(
  '/incidents',
  validate({ query: incidentQuerySchema }),
  adminIncidentController.listIncidents
);
adminRouter.post(
  '/incidents',
  validate({ body: createIncidentBodySchema }),
  adminIncidentController.createIncident
);
adminRouter.get(
  '/incidents/:id',
  validate({ params: incidentIdParamsSchema }),
  adminIncidentController.getIncident
);
adminRouter.patch(
  '/incidents/:id',
  validate({ params: incidentIdParamsSchema, body: updateIncidentBodySchema }),
  adminIncidentController.updateIncident
);
adminRouter.delete(
  '/incidents/:id',
  validate({ params: incidentIdParamsSchema }),
  adminIncidentController.deleteIncident
);
adminRouter.post(
  '/users/:id/reset-2fa',
  validate({ params: adminResetTwoFactorParamsSchema }),
  authController.adminResetTwoFactor
);
adminRouter.get('/email-config', adminEmailConfigController.getSystemEmailConfig);
adminRouter.put(
  '/email-config',
  validate({ body: updateEmailConfigBodySchema }),
  adminEmailConfigController.updateSystemEmailConfig
);
adminRouter.post('/email-config/test', adminEmailConfigController.testSystemEmailConfig);

export default adminRouter;
