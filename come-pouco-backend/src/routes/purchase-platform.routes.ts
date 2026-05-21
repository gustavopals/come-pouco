import { Router } from 'express';

import * as companyPlatformController from '../controllers/company-platform.controller';
import * as purchasePlatformController from '../controllers/purchase-platform.controller';
import {
  createPurchasePlatformBodySchema,
  purchasePlatformParamsSchema,
  purchasePlatformQuerySchema,
  updatePlatformCompaniesBodySchema,
  updatePurchasePlatformBodySchema
} from '../schemas/purchase-platforms.schema';
import { validate } from '../utils/validate';

const purchasePlatformRouter = Router();

purchasePlatformRouter.get(
  '/',
  validate({ query: purchasePlatformQuerySchema }),
  purchasePlatformController.listPurchasePlatforms
);
purchasePlatformRouter.get(
  '/:id/companies',
  validate({ params: purchasePlatformParamsSchema }),
  companyPlatformController.listPlatformCompanies
);
purchasePlatformRouter.post(
  '/',
  validate({ body: createPurchasePlatformBodySchema }),
  purchasePlatformController.createPurchasePlatform
);
purchasePlatformRouter.put(
  '/:id/companies',
  validate({ params: purchasePlatformParamsSchema, body: updatePlatformCompaniesBodySchema }),
  companyPlatformController.updatePlatformCompanies
);
purchasePlatformRouter.put(
  '/:id',
  validate({ params: purchasePlatformParamsSchema, body: updatePurchasePlatformBodySchema }),
  purchasePlatformController.updatePurchasePlatform
);
purchasePlatformRouter.delete(
  '/:id',
  validate({ params: purchasePlatformParamsSchema }),
  purchasePlatformController.deletePurchasePlatform
);

export default purchasePlatformRouter;
