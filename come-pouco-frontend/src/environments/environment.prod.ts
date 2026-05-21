import { sentry } from './sentry.generated';

export const environment = {
  apiUrl: 'https://apicomepouco.palsincomehub.com/api',
  appEnv: 'production',
  sentry: {
    dsn: sentry.dsn,
    release: sentry.release || undefined,
    environment: sentry.environment || 'production',
    tracesSampleRate: sentry.tracesSampleRate ?? 0.1,
  },
};
