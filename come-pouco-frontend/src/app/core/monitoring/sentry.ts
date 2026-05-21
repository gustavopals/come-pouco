import {
  ErrorHandler,
  EnvironmentProviders,
  Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';
import * as Sentry from '@sentry/angular';

import { environment } from '../../../environments/environment';
import type { AuthUser } from '../models/auth.model';

type Sanitizable =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null
  | undefined;

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
  'email',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
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

const scrubSensitiveData = (value: Sanitizable, depth = 0): Sanitizable => {
  if (depth > 8) {
    return '[MaxDepth]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item as Sanitizable, depth + 1));
  }

  if (!isRecord(value)) {
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

      return [key, scrubSensitiveData(nestedValue as Sanitizable, depth + 1)];
    }),
  );
};

const isSentryConfigured = (): boolean => Boolean(environment.sentry.dsn);

const initFrontendSentry = (): void => {
  if (!isSentryConfigured()) {
    return;
  }

  Sentry.init({
    dsn: environment.sentry.dsn,
    environment: environment.sentry.environment,
    release: environment.sentry.release,
    tracesSampleRate: environment.sentry.tracesSampleRate,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend: (event) => {
      const sanitized = scrubSensitiveData(
        event as unknown as Sanitizable,
      ) as unknown as typeof event;

      if (sanitized.user) {
        sanitized.user = {
          id: sanitized.user.id,
        };
      }

      return sanitized;
    },
  });
};

const captureFrontendException = (
  error: unknown,
  context: Record<string, string | number | boolean | null> = {},
): string | undefined => {
  if (!Sentry.isInitialized()) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value !== null) {
        scope.setTag(key, String(value));
      }
    });

    return Sentry.captureException(error);
  });
};

const setSentryUser = (user: AuthUser | null): void => {
  if (!Sentry.isInitialized()) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({ id: String(user.id) });
  Sentry.setTags({
    userRole: user.role,
    companyId: user.companyId === null ? 'none' : String(user.companyId),
    companyRole: user.companyRole ?? 'none',
  });
};

const provideSentry = (): Array<Provider | EnvironmentProviders> => [
  {
    provide: ErrorHandler,
    useValue: Sentry.createErrorHandler({
      showDialog: false,
      logErrors: environment.appEnv !== 'production',
    }),
  },
  provideAppInitializer(() => {
    if (Sentry.isInitialized()) {
      inject(Sentry.TraceService);
    }
  }),
];

export {
  captureFrontendException,
  initFrontendSentry,
  provideSentry,
  setSentryUser,
  scrubSensitiveData,
};
