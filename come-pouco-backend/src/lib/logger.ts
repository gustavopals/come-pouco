import type { Request, Response } from 'express';
import pino, { type LoggerOptions } from 'pino';
import pinoHttp from 'pino-http';

import env from '../config/env';

const REDACTED = '[REDACTED]';

const sensitiveFieldNames = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'tempToken',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
  'setCookie',
  'twoFactorSecret',
  'twoFactorSecretPending',
  'backupCode',
  'apiKey',
  'secret',
  'accessKey',
  'smtpPassword',
  'resendApiKey',
  'sendgridApiKey',
  'sesAccessKey',
  'sesSecretKey',
  'mailgunApiKey'
];

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-access-token"]',
  'res.headers["set-cookie"]',
  ...sensitiveFieldNames.flatMap((field) => [
    field,
    `*.${field}`,
    `*.*.${field}`,
    `req.body.${field}`,
    `req.query.${field}`,
    `req.params.${field}`,
    `body.${field}`,
    `payload.${field}`,
    `metadata.${field}`
  ])
];

const shouldUsePrettyLogs = env.appEnv !== 'production' && env.logFormat === 'pretty';

const loggerOptions: LoggerOptions = {
  level: env.logLevel,
  base: {
    service: 'come-pouco-backend',
    env: env.appEnv
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: redactPaths,
    censor: REDACTED
  }
};

if (shouldUsePrettyLogs) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  };
}

const logger = pino(loggerOptions);

const getRouteTemplate = (req: Request): string => {
  const routePath = req.route?.path;
  const normalizedRoutePath =
    typeof routePath === 'string'
      ? routePath
      : Array.isArray(routePath)
        ? routePath.join('|')
        : undefined;

  if (normalizedRoutePath) {
    return `${req.baseUrl || ''}${normalizedRoutePath}`;
  }

  return (req.originalUrl || req.url).split('?')[0] || 'unknown';
};

const getRequestLogContext = (req: Request) => ({
  requestId: req.id,
  userId: req.userId,
  companyId: req.companyId,
  eventType: 'http_request',
  route: getRouteTemplate(req)
});

const httpLogger = pinoHttp<Request, Response>({
  logger,
  genReqId: (req) => req.id || 'unknown',
  customAttributeKeys: {
    reqId: 'requestId',
    responseTime: 'responseTimeMs'
  },
  customProps: (req) => getRequestLogContext(req),
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
  customSuccessMessage: () => 'request completed',
  customErrorMessage: () => 'request failed',
  customSuccessObject: (req, _res, value) => ({
    ...value,
    ...getRequestLogContext(req),
    eventType: 'http_request_completed'
  }),
  customErrorObject: (req, _res, error, value) => ({
    ...value,
    ...getRequestLogContext(req),
    eventType: 'http_request_failed',
    err: error
  })
});

export { httpLogger, logger };
