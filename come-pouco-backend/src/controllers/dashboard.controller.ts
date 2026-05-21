import { NextFunction, Request, Response } from 'express';

import type {
  ConversionDashboardQuery,
  ConversionTimelineQuery,
  ConversionTopProductsQuery
} from '../schemas/dashboard.schema';
import * as dashboardService from '../services/dashboard.service';
import HttpError from '../utils/httpError';

const getDashboardScope = (req: Request): dashboardService.DashboardScope => {
  if (!req.userId) {
    throw new HttpError(401, 'Usuario nao autenticado.');
  }

  return {
    userRole: req.userRole || 'USER',
    companyId: req.companyId || null,
    companyRole: req.companyRole || null
  };
};

const handleDashboardError = (error: unknown, next: NextFunction): void => {
  if (error instanceof Error && error.message === 'CONVERSIONS_DASHBOARD_FORBIDDEN') {
    next(
      new HttpError(403, 'Acesso restrito a ADMIN ou OWNER.', 'DASHBOARD_CONVERSIONS_FORBIDDEN')
    );
    return;
  }

  if (error instanceof Error && error.message === 'CONVERSIONS_EMPLOYEE_NOT_FOUND') {
    next(
      new HttpError(
        404,
        'Colaborador nao encontrado para esta empresa.',
        'DASHBOARD_EMPLOYEE_NOT_FOUND'
      )
    );
    return;
  }

  next(error);
};

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

export const getConversionSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await dashboardService.getConversionSummary(
      getDashboardScope(req),
      req.query as unknown as ConversionDashboardQuery
    );
    res.status(200).json(summary);
  } catch (error) {
    handleDashboardError(error, next);
  }
};

export const getConversionTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await dashboardService.getConversionTopProducts(
      getDashboardScope(req),
      req.query as unknown as ConversionTopProductsQuery
    );
    res.status(200).json(products);
  } catch (error) {
    handleDashboardError(error, next);
  }
};

export const getConversionsByEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await dashboardService.getConversionsByEmployee(
      getDashboardScope(req),
      req.query as unknown as ConversionDashboardQuery
    );
    res.status(200).json(employees);
  } catch (error) {
    handleDashboardError(error, next);
  }
};

export const getConversionTimeline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeline = await dashboardService.getConversionTimeline(
      getDashboardScope(req),
      req.query as unknown as ConversionTimelineQuery
    );
    res.status(200).json(timeline);
  } catch (error) {
    handleDashboardError(error, next);
  }
};
