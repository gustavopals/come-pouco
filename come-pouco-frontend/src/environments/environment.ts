import { sentry } from './sentry.generated';

export const environment = {
  apiUrl: '/api',
  appEnv: 'development',
  sentry: {
    dsn: sentry.dsn,
    release: sentry.release || undefined,
    environment: sentry.environment || 'development',
    tracesSampleRate: sentry.tracesSampleRate ?? 1,
  },
};
