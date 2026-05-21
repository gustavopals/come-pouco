import type { NextFunction, Request, Response } from 'express';

import { publicCache } from '../cache/public.cache';
import { getMetrics, getMetricsContentType, updateCacheMetrics } from '../lib/metrics';

const getPrometheusMetrics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    updateCacheMetrics('public', publicCache.stats());
    res.setHeader('Content-Type', getMetricsContentType());
    res.status(200).send(await getMetrics());
  } catch (error) {
    next(error);
  }
};

export { getPrometheusMetrics };
