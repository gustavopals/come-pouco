import { NextFunction, Request, Response } from 'express';

import { getLiveness, getReadiness } from '../services/health.service';

const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json(getLiveness());
};

const getReady = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const readiness = await getReadiness();
    res.status(readiness.status === 'down' ? 503 : 200).json(readiness);
  } catch (error) {
    next(error);
  }
};

export { getHealth, getReady };
