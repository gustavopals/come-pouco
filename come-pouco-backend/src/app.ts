import cors from 'cors';
import compression from 'compression';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import env from './config/env';
import { httpLogger, logger } from './lib/logger';
import { metricsMiddleware } from './lib/metrics';
import { captureBackendException } from './lib/sentry';
import { requestIdMiddleware } from './middlewares/request-id.middleware';
import routes from './routes';
import HttpError from './utils/httpError';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      reportOnly: true
    },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' }
  })
);
app.use(requestIdMiddleware);
app.use(httpLogger);
app.use(metricsMiddleware);

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

    const hostOnly = value
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/g, '')
      .toLowerCase();

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
const isAllowedPublicCorsOrigin = buildCorsOriginChecker(env.publicCorsOrigins);

app.use(
  cors((req, callback) => {
    const origin = req.header('Origin') || undefined;
    const isPublicRoute = req.path.startsWith('/api/public');
    const allowed = isPublicRoute ? isAllowedPublicCorsOrigin(origin) : isAllowedCorsOrigin(origin);

    if (!allowed && origin && env.appEnv === 'development') {
      req.log.warn(
        {
          eventType: 'cors_origin_blocked',
          origin,
          corsType: isPublicRoute ? 'public' : 'app'
        },
        'cors origin blocked'
      );
    }

    callback(null, {
      origin: allowed,
      credentials: true
    });
  })
);
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use('/api', routes);

const getHttpStatusFromError = (error: unknown): number | null => {
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const status = typeof candidate.statusCode === 'number' ? candidate.statusCode : candidate.status;

  if (typeof status !== 'number' || status < 400 || status > 599) {
    return null;
  }

  return status;
};

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const statusCode =
    error instanceof HttpError ? error.statusCode : (getHttpStatusFromError(error) ?? 500);
  const errorType = (error as { type?: unknown }).type;
  const isPayloadTooLarge = statusCode === 413 || errorType === 'entity.too.large';
  const isInvalidJson = statusCode === 400 && error instanceof SyntaxError;
  const message =
    statusCode >= 500
      ? 'Erro interno'
      : isPayloadTooLarge
        ? 'Payload muito grande.'
        : isInvalidJson
          ? 'JSON invalido.'
          : error instanceof Error
            ? error.message
            : 'Erro inesperado.';
  const errorCode =
    statusCode >= 500
      ? 'INTERNAL_ERROR'
      : error instanceof HttpError
        ? error.errorCode
        : isPayloadTooLarge
          ? 'PAYLOAD_TOO_LARGE'
          : isInvalidJson
            ? 'INVALID_JSON'
            : 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    const requestLogger = req.log || logger;
    requestLogger.error(
      {
        eventType: 'http_request_error',
        requestId: req.id,
        userId: req.userId,
        companyId: req.companyId,
        err: error instanceof Error ? error : undefined,
        error: error instanceof Error ? undefined : error
      },
      'unhandled request error'
    );
    captureBackendException(error, {
      req,
      eventType: 'http_request_error',
      statusCode,
      errorCode
    });
  }

  res.status(statusCode).json({
    message,
    errorCode,
    requestId: statusCode >= 500 ? req.id : undefined,
    details:
      error instanceof HttpError &&
      (env.appEnv === 'development' || error.errorCode === 'VALIDATION_ERROR')
        ? error.details
        : undefined
  });
});

export default app;
