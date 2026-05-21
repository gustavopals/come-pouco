import * as Sentry from '@sentry/astro';

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
  'email'
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
    })
  );
};

if (__SENTRY_DSN_LANDING__) {
  Sentry.init({
    dsn: __SENTRY_DSN_LANDING__,
    environment: __SENTRY_ENVIRONMENT__,
    release: __SENTRY_RELEASE__ || undefined,
    tracesSampleRate: __SENTRY_TRACES_SAMPLE_RATE__,
    sendDefaultPii: false,
    beforeSend: (event) => {
      const sanitized = scrubSensitiveData(event as Sanitizable) as typeof event;

      if (sanitized.user) {
        sanitized.user = {
          id: sanitized.user.id
        };
      }

      return sanitized;
    }
  });
}
