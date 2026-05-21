import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const readEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return '';
};

const release = readEnv('SENTRY_RELEASE', 'COMMIT_SHA', 'GIT_SHA');
const org = readEnv('SENTRY_ORG');
const project = readEnv('SENTRY_PROJECT_FRONTEND', 'SENTRY_PROJECT');
const authToken = readEnv('SENTRY_AUTH_TOKEN');
const candidateDistDirs = [
  resolve(__dirname, '../dist/come-pouco-frontend/browser'),
  resolve(__dirname, '../dist/come-pouco-frontend'),
  resolve(__dirname, '../dist'),
];
const distDir = candidateDistDirs.find((candidate) => existsSync(candidate));
const sentryCli = resolve(__dirname, '../node_modules/.bin/sentry-cli');

const missing = [
  ['SENTRY_RELEASE', release],
  ['SENTRY_ORG', org],
  ['SENTRY_PROJECT_FRONTEND', project],
  ['SENTRY_AUTH_TOKEN', authToken],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length) {
  console.log(`[sentry] frontend sourcemap upload skipped: missing ${missing.join(', ')}`);
  process.exit(0);
}

if (!distDir) {
  console.log('[sentry] frontend sourcemap upload skipped: dist directory not found');
  process.exit(0);
}

const result = spawnSync(
  sentryCli,
  [
    'sourcemaps',
    'upload',
    distDir,
    '--org',
    org,
    '--project',
    project,
    '--release',
    release,
    '--rewrite',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_RELEASE: release,
    },
  },
);

process.exit(result.status ?? 1);
