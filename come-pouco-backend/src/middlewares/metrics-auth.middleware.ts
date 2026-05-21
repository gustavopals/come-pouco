import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import env from '../config/env';

const REALM = 'auralinks Metrics';

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const parseBasicAuth = (
  authorization: string | undefined
): { user: string; password: string } | null => {
  if (!authorization?.startsWith('Basic ')) {
    return null;
  }

  const encoded = authorization.slice('Basic '.length).trim();

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
};

const metricsAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.metrics.configured) {
    res.status(503).json({
      message: 'Endpoint de metricas nao configurado.',
      errorCode: 'METRICS_NOT_CONFIGURED'
    });
    return;
  }

  const credentials = parseBasicAuth(req.header('authorization'));
  const valid =
    credentials !== null &&
    safeEqual(credentials.user, env.metrics.user) &&
    safeEqual(credentials.password, env.metrics.password);

  if (!valid) {
    res.setHeader('WWW-Authenticate', `Basic realm="${REALM}"`);
    res.status(401).json({
      message: 'Credenciais de metricas invalidas.',
      errorCode: 'METRICS_UNAUTHORIZED'
    });
    return;
  }

  next();
};

export { metricsAuthMiddleware };
