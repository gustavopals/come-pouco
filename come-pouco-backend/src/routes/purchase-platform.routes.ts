import { Router } from 'express';

import * as companyPlatformController from '../controllers/company-platform.controller';
import * as purchasePlatformController from '../controllers/purchase-platform.controller';

const purchasePlatformRouter = Router();

purchasePlatformRouter.get('/', purchasePlatformController.listPurchasePlatforms);
purchasePlatformRouter.get('/:id/companies', companyPlatformController.listPlatformCompanies);
purchasePlatformRouter.post('/', purchasePlatformController.createPurchasePlatform);
purchasePlatformRouter.put('/:id/companies', companyPlatformController.updatePlatformCompanies);
purchasePlatformRouter.put('/:id', purchasePlatformController.updatePurchasePlatform);
purchasePlatformRouter.delete('/:id', purchasePlatformController.deletePurchasePlatform);

export default purchasePlatformRouter;
