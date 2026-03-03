import { NextFunction, Request, Response } from 'express';

import * as companyPlatformService from '../services/company-platform.service';
import * as purchasePlatformService from '../services/purchase-platform.service';
import HttpError from '../utils/httpError';

interface UpdatePlatformCompaniesBody {
  companyIds?: number[];
  defaultCompanyIds?: number[];
}

const parsePlatformId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID da plataforma invalido.');
  }

  return id;
};

const ensureAdmin = (req: Request): void => {
  if (req.userRole !== 'ADMIN') {
    throw new HttpError(403, 'Apenas ADMIN pode gerenciar vinculos de plataforma e empresa.');
  }
};

const normalizeIds = (ids: unknown): number[] => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
};

const listPlatformCompanies = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
  try {
    ensureAdmin(req);

    const platformId = parsePlatformId(req.params.id);
    const platform = await purchasePlatformService.getPurchasePlatformById(platformId);

    if (!platform) {
      throw new HttpError(404, 'Plataforma de compras nao encontrada.');
    }

    const companies = await companyPlatformService.listCompaniesByPlatform(platformId);

    res.status(200).json({ companies });
  } catch (error) {
    next(error);
  }
};

const updatePlatformCompanies = async (
  req: Request<{ id: string }, unknown, UpdatePlatformCompaniesBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAdmin(req);

    const platformId = parsePlatformId(req.params.id);
    const companyIds = normalizeIds(req.body.companyIds);
    const defaultCompanyIds = normalizeIds(req.body.defaultCompanyIds);

    const companies = await companyPlatformService.replaceCompaniesByPlatform(platformId, {
      companyIds,
      defaultCompanyIds
    });

    res.status(200).json({ companies });
  } catch (error) {
    next(error);
  }
};

export { listPlatformCompanies, updatePlatformCompanies };
