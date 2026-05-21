import { defineConfig } from 'vitest/config';
import path from 'node:path';

const coverageTargets = {
  criticalServiceLines: 60
};

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      APP_ENV: 'development',
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-change-me',
      PUBLIC_IP_HASH_SALT: 'test-public-ip-hash-salt',
      SHOPEE_MOCK: 'false'
    },
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    testTimeout: 10_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts', 'src/server.ts', 'src/types/**'],
      watermarks: {
        statements: [coverageTargets.criticalServiceLines, 80],
        branches: [coverageTargets.criticalServiceLines, 80],
        functions: [coverageTargets.criticalServiceLines, 80],
        lines: [coverageTargets.criticalServiceLines, 80]
      }
    }
  }
});
