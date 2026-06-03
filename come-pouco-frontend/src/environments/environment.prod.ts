import { sentry } from './sentry.generated';

export const environment = {
  apiUrl: 'https://api.auralinks.com.br/api',
  appEnv: 'production',
  sentry: {
    dsn: sentry.dsn,
    release: sentry.release || undefined,
    environment: sentry.environment || 'production',
    tracesSampleRate: sentry.tracesSampleRate ?? 0.1,
  },
};
