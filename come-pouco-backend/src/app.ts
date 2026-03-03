import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

import env from './config/env';
import routes from './routes';
import HttpError from './utils/httpError';

const app = express();

const toNormalizedOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
};

const buildCorsOriginChecker = (configuredOrigins: string[]) => {
  const exactOrigins = new Set<string>();
  const wildcardHostSuffixes: string[] = [];
  let allowAll = false;

  configuredOrigins.forEach((raw) => {
    const value = raw.trim();

    if (!value.length) {
      return;
    }

    if (value === '*') {
      allowAll = true;
      return;
    }

    if (value.startsWith('*.')) {
      wildcardHostSuffixes.push(value.slice(1).toLowerCase());
      return;
    }

    const normalized = toNormalizedOrigin(value);

    if (normalized) {
      exactOrigins.add(normalized);
      return;
    }

    const hostOnly = value.replace(/^https?:\/\//i, '').replace(/\/+$/g, '').toLowerCase();

    if (!hostOnly.length) {
      return;
    }

    exactOrigins.add(`http://${hostOnly}`);
    exactOrigins.add(`https://${hostOnly}`);
  });

  return (origin?: string): boolean => {
    if (!origin) {
      return true;
    }

    if (allowAll) {
      return true;
    }

    const normalizedOrigin = toNormalizedOrigin(origin);

    if (!normalizedOrigin) {
      return false;
    }

    if (exactOrigins.has(normalizedOrigin)) {
      return true;
    }

    if (!wildcardHostSuffixes.length) {
      return false;
    }

    const hostname = new URL(normalizedOrigin).hostname.toLowerCase();
    return wildcardHostSuffixes.some((suffix) => hostname.endsWith(suffix));
  };
};

const isAllowedCorsOrigin = buildCorsOriginChecker(env.corsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = isAllowedCorsOrigin(origin);

      if (!allowed && origin && env.appEnv === 'development') {
        console.warn(`[cors] origem bloqueada: ${origin}`);
      }

      callback(null, allowed);
    },
    credentials: true
  })
);
app.use(express.json());
app.use('/api', routes);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = statusCode >= 500 ? 'Erro interno do servidor.' : error instanceof Error ? error.message : 'Erro inesperado.';
  const errorCode = error instanceof HttpError ? error.errorCode : 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
    errorCode,
    details: env.appEnv === 'development' && error instanceof HttpError ? error.details : undefined
  });
});

export default app;
