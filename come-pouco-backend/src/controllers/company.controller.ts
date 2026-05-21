import { NextFunction, Request, Response } from 'express';

import { AUDIT_EVENTS } from '../constants/audit-events';
import type {
  CompanyQuery,
  CreateCompanyBody,
  UpdateCompanyBody
} from '../schemas/companies.schema';
import { logEventFromRequest } from '../services/audit.service';
import * as companyService from '../services/company.service';

const listCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as CompanyQuery;
    const result = await companyService.listCompanies({
      pagination: {
        page: query.page,
        limit: query.limit
      }
    });
    res
      .status(200)
      .json({ companies: result.items, data: result.data, items: result.items, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

const createCompany = async (
  req: Request<Record<string, never>, unknown, CreateCompanyBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      historyRetentionDays,
      shopeePlatformId,
      shopeePlatformTestId,
      shopeePlatformProdId,
      shopeeMode,
      publicSlug,
      fallbackAffiliateUrl
    } = req.body;

    const company = await companyService.createCompany({
      name,
      historyRetentionDays,
      shopeePlatformId,
      shopeePlatformTestId,
      shopeePlatformProdId,
      shopeeMode,
      publicSlug,
      fallbackAffiliateUrl
    });
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_COMPANY_CREATE,
      entityType: 'COMPANY',
      entityId: company.id,
      metadata: {
        name: company.name,
        shopeeMode: company.shopeeMode
      }
    });
    res.status(201).json({ company });
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (
  req: Request<{ id: string }, unknown, UpdateCompanyBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      historyRetentionDays,
      shopeePlatformId,
      shopeePlatformTestId,
      shopeePlatformProdId,
      shopeeMode,
      publicSlug,
      fallbackAffiliateUrl
    } = req.body;

    const company = await companyService.updateCompany(id, {
      name,
      historyRetentionDays,
      shopeePlatformId,
      shopeePlatformTestId,
      shopeePlatformProdId,
      shopeeMode,
      publicSlug,
      fallbackAffiliateUrl
    });
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_COMPANY_UPDATE,
      entityType: 'COMPANY',
      entityId: company.id,
      metadata: {
        changedFields: Object.keys(req.body),
        name: company.name,
        shopeeMode: company.shopeeMode
      }
    });
    res.status(200).json({ company });
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const company = await companyService.getCompanyById(id);

    await companyService.deleteCompany(id);
    logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_COMPANY_DELETE,
      entityType: 'COMPANY',
      entityId: id,
      metadata: {
        name: company?.name ?? null
      }
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createCompany, deleteCompany, listCompanies, updateCompany };
