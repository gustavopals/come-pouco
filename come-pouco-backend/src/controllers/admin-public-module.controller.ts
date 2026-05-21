import { NextFunction, Request, Response } from 'express';

import type { ConversionAnonymizeQuery } from '../schemas/admin.schema';
import * as conversionRetentionService from '../services/conversion-retention.service';
import * as publicModuleMetricsService from '../services/public-module-metrics.service';

const anonymizeConversions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { olderThan } = req.query as unknown as ConversionAnonymizeQuery;
    const result = await conversionRetentionService.anonymizeConversionsOlderThan(olderThan);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getPublicModuleMetrics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const metrics = await publicModuleMetricsService.getPublicModuleMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};

export { anonymizeConversions, getPublicModuleMetrics };
