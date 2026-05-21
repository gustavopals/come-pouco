const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

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
const project = readEnv('SENTRY_PROJECT_BACKEND', 'SENTRY_PROJECT');
const authToken = readEnv('SENTRY_AUTH_TOKEN');
const distDir = resolve(__dirname, '../dist');
const sentryCli = resolve(__dirname, '../node_modules/.bin/sentry-cli');

const missing = [
  ['SENTRY_RELEASE', release],
  ['SENTRY_ORG', org],
  ['SENTRY_PROJECT_BACKEND', project],
  ['SENTRY_AUTH_TOKEN', authToken]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length) {
  console.log(`[sentry] backend sourcemap upload skipped: missing ${missing.join(', ')}`);
  process.exit(0);
}

if (!existsSync(distDir)) {
  console.log('[sentry] backend sourcemap upload skipped: dist directory not found');
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
    '--rewrite'
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_RELEASE: release
    }
  }
);

process.exit(result.status ?? 1);
