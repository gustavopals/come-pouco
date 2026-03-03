import { Router } from 'express';

import * as integrationController from '../controllers/integration.controller';

const integrationRouter = Router();

integrationRouter.post('/shopee/generate-shortlinks', integrationController.generateShopeeShortLinksController);

export default integrationRouter;
