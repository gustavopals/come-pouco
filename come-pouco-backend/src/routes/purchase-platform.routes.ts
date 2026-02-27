import { Router } from 'express';

import * as purchasePlatformController from '../controllers/purchase-platform.controller';

const purchasePlatformRouter = Router();

purchasePlatformRouter.get('/', purchasePlatformController.listPurchasePlatforms);
purchasePlatformRouter.post('/', purchasePlatformController.createPurchasePlatform);
purchasePlatformRouter.put('/:id', purchasePlatformController.updatePurchasePlatform);
purchasePlatformRouter.delete('/:id', purchasePlatformController.deletePurchasePlatform);

export default purchasePlatformRouter;
