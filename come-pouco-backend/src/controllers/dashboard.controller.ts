import { NextFunction, Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import HttpError from '../utils/httpError';

export const getProductionSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      throw new HttpError(401, 'Usuario nao autenticado.');
    }

    const companyId = req.companyId || null;
    const userRole = req.userRole || 'USER';

    const summary = await dashboardService.getProductionSummary(companyId, userRole);

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};
