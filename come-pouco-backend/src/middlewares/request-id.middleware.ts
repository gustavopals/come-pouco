import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'X-Request-Id';
const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

const getIncomingRequestId = (req: Request): string | null => {
  const raw = req.header(REQUEST_ID_HEADER);

  if (!raw) {
    return null;
  }

  const value = raw.trim();

  if (!value || value.length > REQUEST_ID_MAX_LENGTH || !REQUEST_ID_PATTERN.test(value)) {
    return null;
  }

  return value;
};

const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = getIncomingRequestId(req) || randomUUID();

  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
};

export { REQUEST_ID_HEADER, requestIdMiddleware };
