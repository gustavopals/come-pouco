import { NextFunction, Request, Response } from 'express';

import { publicCache } from '../cache/public.cache';

const getCacheStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      publicCache: publicCache.stats()
    });
  } catch (error) {
    next(error);
  }
};

export { getCacheStats };
