import { Router } from 'express';

import * as affiliateLinkController from '../controllers/affiliate-link.controller';
import {
  affiliateLinkParamsSchema,
  affiliateLinkQuerySchema,
  createAffiliateLinkBodySchema,
  updateAffiliateLinkBodySchema
} from '../schemas/affiliate-links.schema';
import { validate } from '../utils/validate';

const affiliateLinkRouter = Router();

affiliateLinkRouter.get(
  '/',
  validate({ query: affiliateLinkQuerySchema }),
  affiliateLinkController.listAffiliateLinks
);
affiliateLinkRouter.post(
  '/',
  validate({ body: createAffiliateLinkBodySchema }),
  affiliateLinkController.createAffiliateLink
);
affiliateLinkRouter.delete(
  '/',
  validate({ query: affiliateLinkQuerySchema }),
  affiliateLinkController.deleteAffiliateLinks
);
affiliateLinkRouter.put(
  '/:id',
  validate({ params: affiliateLinkParamsSchema, body: updateAffiliateLinkBodySchema }),
  affiliateLinkController.updateAffiliateLink
);
affiliateLinkRouter.delete(
  '/:id',
  validate({ params: affiliateLinkParamsSchema }),
  affiliateLinkController.deleteAffiliateLink
);

export default affiliateLinkRouter;
