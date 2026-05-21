import { Router } from 'express';

import * as integrationController from '../controllers/integration.controller';
import { shopeeShortlinkRateLimiter } from '../middlewares/rate-limit.middleware';
import { generateShopeeShortLinksBodySchema } from '../schemas/integration.schema';
import { validate } from '../utils/validate';

const integrationRouter = Router();

integrationRouter.post(
  '/shopee/generate-shortlinks',
  shopeeShortlinkRateLimiter,
  validate({ body: generateShopeeShortLinksBodySchema }),
  integrationController.generateShopeeShortLinksController
);

export default integrationRouter;
