import { Router } from 'express';

import * as affiliateLinkController from '../controllers/affiliate-link.controller';

const affiliateLinkRouter = Router();

affiliateLinkRouter.get('/', affiliateLinkController.listAffiliateLinks);
affiliateLinkRouter.post('/', affiliateLinkController.createAffiliateLink);
affiliateLinkRouter.put('/:id', affiliateLinkController.updateAffiliateLink);
affiliateLinkRouter.delete('/:id', affiliateLinkController.deleteAffiliateLink);

export default affiliateLinkRouter;
