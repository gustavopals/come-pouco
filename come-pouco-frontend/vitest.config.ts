import { defineConfig } from 'vitest/config';

const coverageTargets = {
  coreLines: 45,
};

export default defineConfig({
  test: {
    coverage: {
      watermarks: {
        statements: [coverageTargets.coreLines, 80],
        branches: [coverageTargets.coreLines, 80],
        functions: [coverageTargets.coreLines, 80],
        lines: [coverageTargets.coreLines, 80],
      },
    },
  },
});
