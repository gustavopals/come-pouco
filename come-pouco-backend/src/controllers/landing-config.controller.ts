import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import type {
  UpdateCompanyFallbackUrlBody,
  UpdateCompanyPublicSlugBody,
  UpdateLandingConfigBody,
  UpdateUserPublicSlugBody
} from '../schemas/landing-config.schema';
import * as landingConfigService from '../services/landing-config.service';
import * as landingProfileImageService from '../services/landing-profile-image.service';
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

const uploadLandingProfileImage = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'Envie uma imagem valida.', 'LANDING_PROFILE_IMAGE_MISSING');
    }

    const result = await landingProfileImageService.uploadLandingProfileImage(
      Number(req.params.id),
      {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname
      },
      getAccessScope(req)
    );

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(
        new HttpError(
          400,
          'Imagem muito grande. O tamanho maximo e 2 MB.',
          'LANDING_PROFILE_IMAGE_TOO_LARGE'
        )
      );
      return;
    }

    next(error);
  }
};

const removeLandingProfileImage = async (
  req: Request<IdParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await landingProfileImageService.removeLandingProfileImage(
      Number(req.params.id),
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
  removeLandingProfileImage,
  updateCompanyFallbackUrl,
  updateCompanyPublicSlug,
  updateLandingConfig,
  updateUserPublicSlug,
  uploadLandingProfileImage
};
