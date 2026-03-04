import { NextFunction, Request, Response } from 'express';

import * as apiUsageService from '../services/api-usage.service';
import HttpError from '../utils/httpError';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseSingleQueryParam = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
};

const parsePositiveInt = (value: unknown, label: string): number | undefined => {
  const raw = parseSingleQueryParam(value);

  if (!raw?.trim().length) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${label} invalido.`);
  }

  return parsed;
};

const parseDateFilter = (value: unknown, label: string, endOfDay = false): Date | undefined => {
  const raw = parseSingleQueryParam(value);
  if (!raw?.trim().length) {
    return undefined;
  }

  if (DATE_ONLY_PATTERN.test(raw)) {
    if (!endOfDay) {
      return new Date(`${raw}T00:00:00.000Z`);
    }

    return new Date(`${raw}T23:59:59.999Z`);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${label} invalida.`);
  }

  return parsed;
};

const parseMode = (value: unknown): apiUsageService.ApiUsageMode | undefined => {
  const raw = parseSingleQueryParam(value);

  if (!raw?.trim().length) {
    return undefined;
  }

  const normalized = raw.trim().toUpperCase();
  if (normalized !== 'MOCK' && normalized !== 'REAL') {
    throw new HttpError(400, 'mode invalido. Use MOCK ou REAL.');
  }

  return normalized;
};

const getApiUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = parsePositiveInt(req.query.companyId, 'companyId');
    const userId = parsePositiveInt(req.query.userId, 'userId');
    const startDate = parseDateFilter(req.query.startDate, 'startDate');
    const endDate = parseDateFilter(req.query.endDate, 'endDate', true);
    const mode = parseMode(req.query.mode);

    if (startDate && endDate && startDate > endDate) {
      throw new HttpError(400, 'startDate deve ser menor ou igual a endDate.');
    }

    const usage = await apiUsageService.getApiUsageSummary({
      companyId,
      userId,
      startDate,
      endDate,
      mode
    });

    res.status(200).json(usage);
  } catch (error) {
    next(error);
  }
};

const deleteMockApiUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = parsePositiveInt(req.query.companyId, 'companyId');
    const startDate = parseDateFilter(req.query.startDate, 'startDate');
    const endDate = parseDateFilter(req.query.endDate, 'endDate', true);

    if (startDate && endDate && startDate > endDate) {
      throw new HttpError(400, 'startDate deve ser menor ou igual a endDate.');
    }

    const deletedCount = await apiUsageService.deleteMockUsage({
      companyId,
      startDate,
      endDate
    });

    res.status(200).json({ deletedCount });
  } catch (error) {
    next(error);
  }
};

export { deleteMockApiUsage, getApiUsage };
