import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import sentry from '@sentry/astro';

const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://auralinks.com.br';
const SENTRY_DSN_LANDING =
  process.env.SENTRY_DSN_LANDING || process.env.PUBLIC_SENTRY_DSN_LANDING || '';
const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT || process.env.APP_ENV || process.env.NODE_ENV || 'production';
const SENTRY_RELEASE =
  process.env.SENTRY_RELEASE || process.env.COMMIT_SHA || process.env.GIT_SHA || '';
const SENTRY_TRACES_SAMPLE_RATE = Number(
  process.env.SENTRY_TRACES_SAMPLE_RATE_LANDING ||
    process.env.SENTRY_TRACES_SAMPLE_RATE ||
    (SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1)
);
const SENTRY_ORG = process.env.SENTRY_ORG || '';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT_LANDING || process.env.SENTRY_PROJECT || '';
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN || '';
const HAS_SENTRY_SOURCE_MAP_UPLOAD = Boolean(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);
const normalizedSentryTracesSampleRate = Number.isFinite(SENTRY_TRACES_SAMPLE_RATE)
  ? Math.min(1, Math.max(0, SENTRY_TRACES_SAMPLE_RATE))
  : SENTRY_ENVIRONMENT === 'production'
    ? 0.1
    : 1;

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto'
  },
  integrations: [
    sentry({
      enabled: {
        client: Boolean(SENTRY_DSN_LANDING),
        server: false
      },
      org: SENTRY_ORG || undefined,
      project: SENTRY_PROJECT || undefined,
      authToken: SENTRY_AUTH_TOKEN || undefined,
      telemetry: false,
      sourcemaps: {
        disable: HAS_SENTRY_SOURCE_MAP_UPLOAD ? false : 'disable-upload',
        filesToDeleteAfterUpload: HAS_SENTRY_SOURCE_MAP_UPLOAD ? ['dist/**/*.map'] : []
      },
      errorHandler: (error) => {
        console.warn(`[sentry] sourcemap upload failed: ${error.message}`);
      }
    }),
    sitemap({
      filter: (page) => !/\/dev(\/|$)/.test(new URL(page).pathname)
    }),
    mdx()
  ],
  vite: {
    define: {
      __SENTRY_DSN_LANDING__: JSON.stringify(SENTRY_DSN_LANDING),
      __SENTRY_ENVIRONMENT__: JSON.stringify(SENTRY_ENVIRONMENT),
      __SENTRY_RELEASE__: JSON.stringify(SENTRY_RELEASE),
      __SENTRY_TRACES_SAMPLE_RATE__: JSON.stringify(normalizedSentryTracesSampleRate)
    }
  },
  server: {
    port: 4321,
    host: true
  }
});
