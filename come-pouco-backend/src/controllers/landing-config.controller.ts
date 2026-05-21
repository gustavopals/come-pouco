import { NextFunction, Request, Response } from 'express';

import type {
  UpdateCompanyFallbackUrlBody,
  UpdateCompanyPublicSlugBody,
  UpdateLandingConfigBody,
  UpdateUserPublicSlugBody
} from '../schemas/landing-config.schema';
import * as landingConfigService from '../services/landing-config.service';
import HttpError from '../utils/httpError';

type IdParams = { id: string };

const getLandingConfig = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await landingConfigService.getLandingConfig(
      Number(req.params.id),
      getAccessScope(req)
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateLandingConfig = async (
  req: Request<IdParams, unknown, UpdateLandingConfigBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await landingConfigService.updateLandingConfig(
      Number(req.params.id),
      req.body,
      getAccessScope(req)
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateCompanyPublicSlug = async (
  req: Request<IdParams, unknown, UpdateCompanyPublicSlugBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await landingConfigService.updateCompanyPublicSlug(
      Number(req.params.id),
      req.body.publicSlug,
      getAccessScope(req)
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateCompanyFallbackUrl = async (
  req: Request<IdParams, unknown, UpdateCompanyFallbackUrlBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await landingConfigService.updateCompanyFallbackAffiliateUrl(
      Number(req.params.id),
      req.body.fallbackAffiliateUrl,
      getAccessScope(req)
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateUserPublicSlug = async (
  req: Request<IdParams, unknown, UpdateUserPublicSlugBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await landingConfigService.updateUserPublicSlug(
      Number(req.params.id),
      req.body.publicSlug,
      getAccessScope(req)
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAccessScope = (req: Request): landingConfigService.AccessScope => {
  if (!req.userRole) {
    throw new HttpError(401, 'Token invalido ou expirado.', 'AUTH_TOKEN_MISSING');
  }

  return {
    requesterRole: req.userRole,
    requesterCompanyId: req.companyId ?? null,
    requesterCompanyRole: req.companyRole ?? null
  };
};

export {
  getLandingConfig,
  updateCompanyFallbackUrl,
  updateCompanyPublicSlug,
  updateLandingConfig,
  updateUserPublicSlug
};
