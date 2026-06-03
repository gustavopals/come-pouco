import { Router } from 'express';

import { createLeadHandler } from '../controllers/lead.controller';
import * as publicController from '../controllers/public.controller';
import {
  publicConvertDailyRateLimiter,
  publicConvertMinuteRateLimiter,
  publicLandingRateLimiter,
  publicSecurityMetadataMiddleware
} from '../middlewares/public-rate-limit.middleware';
import { buildAuthRateLimiter } from '../middlewares/rate-limit.middleware';
import { leadCreateSchema } from '../schemas/leads.schema';
import { publicConvertBodySchema, publicSlugParamSchema } from '../schemas/public.schema';
import { validate } from '../utils/validate';

const leadRateLimiter = buildAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Muitos envios em pouco tempo. Tente novamente em alguns minutos.',
  errorCode: 'RATE_LIMIT_PUBLIC_LEADS'
});

const publicRouter = Router();

publicRouter.use(publicSecurityMetadataMiddleware);
publicRouter.get('/healthz', publicController.getPublicHealthz);
publicRouter.get('/uploads/landing-logos/:filename', publicController.getLandingProfileImage);
publicRouter.get(
  '/landing/:slug',
  publicLandingRateLimiter,
  validate({ params: publicSlugParamSchema }),
  publicController.getLanding
);
publicRouter.post(
  '/convert',
  publicConvertDailyRateLimiter,
  publicConvertMinuteRateLimiter,
  validate({ body: publicConvertBodySchema }),
  publicController.convert
);

publicRouter.post(
  '/leads',
  leadRateLimiter,
  validate({ body: leadCreateSchema }),
  createLeadHandler
);

export default publicRouter;
