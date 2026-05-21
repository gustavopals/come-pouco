import { defineConfig } from 'vitest/config';

const coverageTargets = {
  landingLines: 45
};

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      watermarks: {
        statements: [coverageTargets.landingLines, 80],
        branches: [coverageTargets.landingLines, 80],
        functions: [coverageTargets.landingLines, 80],
        lines: [coverageTargets.landingLines, 80]
      }
    }
  }
});
