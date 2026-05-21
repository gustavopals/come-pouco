import { NextFunction, Request, Response } from 'express';

import type { ApiUsageQuery, DeleteMockApiUsageQuery } from '../schemas/admin.schema';
import * as apiUsageService from '../services/api-usage.service';

const getApiUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { companyId, userId, startDate, endDate, mode, page, limit } =
      req.query as unknown as ApiUsageQuery;

    const usage = await apiUsageService.getApiUsageSummary({
      companyId,
      userId,
      startDate,
      endDate,
      mode,
      pagination: {
        page,
        limit
      }
    });

    res.status(200).json(usage);
  } catch (error) {
    next(error);
  }
};

const deleteMockApiUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { companyId, startDate, endDate } = req.query as unknown as DeleteMockApiUsageQuery;

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
