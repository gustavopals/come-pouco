import { Router } from 'express';

import * as companyController from '../controllers/company.controller';
import * as landingConfigController from '../controllers/landing-config.controller';
import { landingProfileImageUploadMiddleware } from '../middlewares/landing-profile-upload.middleware';
import requireRole from '../middlewares/role.middleware';
import {
  companyParamsSchema,
  companyQuerySchema,
  createCompanyBodySchema,
  updateCompanyBodySchema
} from '../schemas/companies.schema';
import {
  landingConfigParamsSchema,
  updateCompanyFallbackUrlBodySchema,
  updateCompanyPublicSlugBodySchema,
  updateLandingConfigBodySchema
} from '../schemas/landing-config.schema';
import { validate } from '../utils/validate';

const companyRouter = Router();

companyRouter.get(
  '/',
  requireRole('ADMIN'),
  validate({ query: companyQuerySchema }),
  companyController.listCompanies
);
companyRouter.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: createCompanyBodySchema }),
  companyController.createCompany
);
companyRouter.get(
  '/:id/landing-config',
  validate({ params: landingConfigParamsSchema }),
  landingConfigController.getLandingConfig
);
companyRouter.post(
  '/:id/landing-config/profile-image',
  validate({ params: landingConfigParamsSchema }),
  landingProfileImageUploadMiddleware,
  landingConfigController.uploadLandingProfileImage
);
companyRouter.delete(
  '/:id/landing-config/profile-image',
  validate({ params: landingConfigParamsSchema }),
  landingConfigController.removeLandingProfileImage
);
companyRouter.put(
  '/:id/landing-config',
  validate({ params: landingConfigParamsSchema, body: updateLandingConfigBodySchema }),
  landingConfigController.updateLandingConfig
);
companyRouter.put(
  '/:id/public-slug',
  validate({ params: landingConfigParamsSchema, body: updateCompanyPublicSlugBodySchema }),
  landingConfigController.updateCompanyPublicSlug
);
companyRouter.put(
  '/:id/fallback-url',
  validate({ params: landingConfigParamsSchema, body: updateCompanyFallbackUrlBodySchema }),
  landingConfigController.updateCompanyFallbackUrl
);
companyRouter.put(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: companyParamsSchema, body: updateCompanyBodySchema }),
  companyController.updateCompany
);
companyRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: companyParamsSchema }),
  companyController.deleteCompany
);

export default companyRouter;
