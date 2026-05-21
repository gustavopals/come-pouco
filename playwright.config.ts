import { defineConfig, devices } from '@playwright/test';

const frontendURL = process.env.E2E_FRONTEND_URL || 'http://127.0.0.1:4200';
const backendURL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:3001';
const landingURL = process.env.E2E_LANDING_URL || 'http://127.0.0.1:4321';
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === 'true';

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'npm run e2e:server:backend',
          url: `${backendURL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe'
        },
        {
          command: 'npm run e2e:server:frontend',
          url: frontendURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe'
        },
        {
          command: 'npm run e2e:server:landing',
          url: landingURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe'
        }
      ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
