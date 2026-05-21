import type { Request } from 'express';
import * as Sentry from '@sentry/node';

import env from '../config/env';
import { logger } from './logger';
import { recordSentryEvent } from './metrics';

const SENTRY_FLUSH_TIMEOUT_MS = 2000;
const sentryLogger = logger.child({ scope: 'sentry' });

const sensitiveKeyFragments = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'twofactor',
  'two_factor',
  'backupcode',
  'backup_code',
  'smtp',
  'sendgrid',
  'resend',
  'mailgun',
  'ses'
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const shouldRedactKey = (key: string): boolean => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
};

const sanitizeUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return value;
  }
};

const scrubSensitiveData = (value: unknown, depth = 0): unknown => {
  if (depth > 8) {
    return '[MaxDepth]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      if (shouldRedactKey(key)) {
        return [key, '[REDACTED]'];
      }

      if ((key === 'url' || key === 'href') && typeof nestedValue === 'string') {
        return [key, sanitizeUrl(nestedValue)];
      }

      return [key, scrubSensitiveData(nestedValue, depth + 1)];
    })
  );
};

const beforeSend: NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['beforeSend']> = (
  event
) => {
  const sanitized = scrubSensitiveData(event) as typeof event;

  if (sanitized.user) {
    sanitized.user = {
      id: sanitized.user.id
    };
  }

  return sanitized;
};

const initSentry = (): boolean => {
  if (!env.sentry.backendDsn) {
    sentryLogger.info(
      { eventType: 'sentry_disabled', reason: 'missing_backend_dsn' },
      'Sentry disabled'
    );
    return false;
  }

  Sentry.init({
    dsn: env.sentry.backendDsn,
    environment: env.sentry.environment,
    release: env.sentry.release ?? undefined,
    tracesSampleRate: env.sentry.tracesSampleRate,
    sendDefaultPii: false,
    beforeSend
  });

  sentryLogger.info(
    {
      eventType: 'sentry_initialized',
      environment: env.sentry.environment,
      release: env.sentry.release,
      tracesSampleRate: env.sentry.tracesSampleRate
    },
    'Sentry initialized'
  );
  return true;
};

const sentryEnabled = initSentry();

const captureBackendException = (
  error: unknown,
  context: {
    req?: Request;
    eventType?: string;
    statusCode?: number;
    errorCode?: string;
  } = {}
): string | undefined => {
  if (!sentryEnabled || !Sentry.isInitialized()) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    const req = context.req;

    if (context.eventType) {
      scope.setTag('eventType', context.eventType);
    }

    if (context.statusCode) {
      scope.setTag('statusCode', String(context.statusCode));
    }

    if (context.errorCode) {
      scope.setTag('errorCode', context.errorCode);
    }

    if (req?.id) {
      scope.setTag('requestId', String(req.id));
    }

    if (req?.userId) {
      scope.setUser({ id: String(req.userId) });
      scope.setTag('userId', String(req.userId));
    }

    if (req?.companyId) {
      scope.setTag('companyId', String(req.companyId));
    }

    if (req) {
      scope.setContext('request', {
        method: req.method,
        path: req.path,
        originalUrl: sanitizeUrl(req.originalUrl || req.url),
        ip: req.ip
      });
    }

    const eventId = Sentry.captureException(error);
    recordSentryEvent({ surface: 'backend', eventType: 'exception' });
    return eventId;
  });
};

const flushSentry = async (timeoutMs = SENTRY_FLUSH_TIMEOUT_MS): Promise<boolean> => {
  if (!sentryEnabled || !Sentry.isInitialized()) {
    return true;
  }

  return Sentry.flush(timeoutMs);
};

export { captureBackendException, flushSentry, sentryEnabled, scrubSensitiveData };
