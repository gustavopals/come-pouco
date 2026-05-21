import { NextFunction, Request, Response } from 'express';

import { AUDIT_EVENTS } from '../constants/audit-events';
import type { UpdatePlatformCompaniesBody } from '../schemas/purchase-platforms.schema';
import { logEventFromRequest } from '../services/audit.service';
import * as companyPlatformService from '../services/company-platform.service';
import * as purchasePlatformService from '../services/purchase-platform.service';
import HttpError from '../utils/httpError';

const ensureAdmin = (req: Request): void => {
  if (req.userRole !== 'ADMIN') {
    throw new HttpError(403, 'Apenas ADMIN pode gerenciar vinculos de plataforma e empresa.');
  }
};

const listPlatformCompanies = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ensureAdmin(req);

    const platformId = Number(req.params.id);
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

    const platformId = Number(req.params.id);
    const { companyIds, defaultCompanyIds } = req.body;

    const companies = await companyPlatformService.replaceCompaniesByPlatform(platformId, {
      companyIds,
      defaultCompanyIds
    });

    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_PLATFORM_UPDATE,
      entityType: 'PURCHASE_PLATFORM',
      entityId: platformId,
      metadata: {
        changedFields: ['companyLinks'],
        companyIds,
        defaultCompanyIds
      }
    });

    res.status(200).json({ companies });
  } catch (error) {
    next(error);
  }
};

export { listPlatformCompanies, updatePlatformCompanies };
