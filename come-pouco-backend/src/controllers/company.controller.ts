import { NextFunction, Request, Response } from 'express';

import { ALLOWED_HISTORY_RETENTION_DAYS } from '../constants/company.constants';
import * as companyService from '../services/company.service';
import HttpError from '../utils/httpError';

interface CreateCompanyBody {
  name?: string;
  historyRetentionDays?: number;
  shopeePlatformId?: number | null;
  shopeePlatformTestId?: number | null;
  shopeePlatformProdId?: number | null;
  shopeeMode?: 'TEST' | 'PROD';
}

interface UpdateCompanyBody {
  name?: string;
  historyRetentionDays?: number;
  shopeePlatformId?: number | null;
  shopeePlatformTestId?: number | null;
  shopeePlatformProdId?: number | null;
  shopeeMode?: 'TEST' | 'PROD';
}

const parseShopeePlatformId = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, 'Plataforma Shopee invalida.');
  }

  return parsed;
};

const parseShopeeMode = (value: unknown): 'TEST' | 'PROD' | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'TEST' || value === 'PROD') {
    return value;
  }

  throw new HttpError(400, 'Modo Shopee invalido. Use TEST ou PROD.');
};

const parseHistoryRetentionDays = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, 'historyRetentionDays invalido.');
  }

  if (!ALLOWED_HISTORY_RETENTION_DAYS.includes(parsed)) {
    throw new HttpError(
      400,
      `historyRetentionDays invalido. Valores permitidos: ${ALLOWED_HISTORY_RETENTION_DAYS.join(', ')}.`
    );
  }

  return parsed;
};

const parseCompanyId = (value: string): number => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'ID da empresa invalido.');
  }

  return id;
};

const listCompanies = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companies = await companyService.listCompanies();
    res.status(200).json({ companies });
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
    const { name } = req.body;
    const historyRetentionDays = parseHistoryRetentionDays(req.body.historyRetentionDays);
    const shopeePlatformId = parseShopeePlatformId(req.body.shopeePlatformId);
    const shopeePlatformTestId = parseShopeePlatformId(req.body.shopeePlatformTestId);
    const shopeePlatformProdId = parseShopeePlatformId(req.body.shopeePlatformProdId);
    const shopeeMode = parseShopeeMode(req.body.shopeeMode);

    if (!name || !name.trim().length) {
      throw new HttpError(400, 'Nome da empresa e obrigatorio.');
    }

    const company = await companyService.createCompany({
      name,
      historyRetentionDays,
      shopeePlatformId,
      shopeePlatformTestId,
      shopeePlatformProdId,
      shopeeMode
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
    const id = parseCompanyId(req.params.id);
    const { name } = req.body;
    const historyRetentionDays = parseHistoryRetentionDays(req.body.historyRetentionDays);
    const shopeePlatformId = parseShopeePlatformId(req.body.shopeePlatformId);
    const shopeePlatformTestId = parseShopeePlatformId(req.body.shopeePlatformTestId);
    const shopeePlatformProdId = parseShopeePlatformId(req.body.shopeePlatformProdId);
    const shopeeMode = parseShopeeMode(req.body.shopeeMode);

    const company = await companyService.updateCompany(id, {
      name,
      historyRetentionDays,
      shopeePlatformId,
      shopeePlatformTestId,
      shopeePlatformProdId,
      shopeeMode
    });
    res.status(200).json({ company });
  } catch (error) {
    next(error);
  }
};

export { createCompany, listCompanies, updateCompany };
