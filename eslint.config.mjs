import path from 'node:path';
import { fileURLToPath } from 'node:url';

import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ignores = {
  ignores: [
    '**/.angular/**',
    '**/.astro/**',
    '**/coverage/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/playwright-report/**',
    '**/test-results/**',
    'come-pouco-frontend/src/environments/sentry.generated.ts'
  ]
};

const sharedLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  globals: {
    ...globals.browser,
    ...globals.node,
    ...globals.es2022
  }
};

const baseRules = {
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  'no-unused-vars': 'off',
  'prefer-const': ['error', { destructuring: 'all' }],
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-misused-promises': [
    'warn',
    {
      checksVoidReturn: {
        arguments: false,
        attributes: false
      }
    }
  ],
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }
  ]
};

const javascriptConfig = {
  files: ['**/*.{js,cjs,mjs}'],
  ...js.configs.recommended,
  languageOptions: sharedLanguageOptions,
  rules: {
    ...js.configs.recommended.rules,
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    'prefer-const': ['error', { destructuring: 'all' }]
  }
};

const typescriptConfig = {
  files: ['**/*.ts'],
  languageOptions: {
    ...sharedLanguageOptions,
    parser: tseslint.parser,
    parserOptions: {
      project: ['./tsconfig.eslint.json'],
      tsconfigRootDir: __dirname
    }
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin
  },
  rules: {
    ...tseslint.configs.recommended.rules,
    ...baseRules
  }
};

const backendConfig = {
  files: ['come-pouco-backend/**/*.ts'],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.vitest
    }
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn'
  }
};

const frontendConfig = {
  files: ['come-pouco-frontend/**/*.ts'],
  plugins: {
    '@angular-eslint': angular
  },
  rules: {
    ...angular.configs.recommended.rules,
    '@angular-eslint/component-class-suffix': 'off',
    '@angular-eslint/component-selector': [
      'error',
      {
        type: 'element',
        prefix: 'app',
        style: 'kebab-case'
      }
    ],
    '@angular-eslint/directive-class-suffix': 'error',
    '@angular-eslint/directive-selector': [
      'error',
      {
        type: 'attribute',
        prefix: 'app',
        style: 'camelCase'
      }
    ],
    '@angular-eslint/prefer-inject': 'off'
  }
};

const frontendTemplateConfig = {
  files: ['come-pouco-frontend/**/*.html'],
  languageOptions: {
    parser: angularTemplateParser
  },
  plugins: {
    '@angular-eslint/template': angularTemplate
  },
  rules: {
    ...angularTemplate.configs.recommended.rules,
    ...angularTemplate.configs.accessibility.rules,
    '@angular-eslint/template/eqeqeq': 'error',
    '@angular-eslint/template/no-negated-async': 'off',
    '@angular-eslint/template/prefer-control-flow': 'off'
  }
};

const astroConfig = [
  ...astro.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files ?? ['come-pouco-landing/**/*.astro']
  })),
  {
    files: ['come-pouco-landing/**/*.astro'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      'astro/no-set-html-directive': 'off'
    }
  }
];

const testsConfig = {
  files: ['**/*.spec.ts', '**/*.test.ts', 'come-pouco-backend/tests/**/*.ts', 'e2e/**/*.ts'],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.vitest
    }
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
};

const astroVirtualFileConfig = {
  files: ['**/*.astro/*.js', '**/*.astro/*.ts'],
  rules: {
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-misused-promises': 'off'
  }
};

const scriptConfig = {
  files: ['**/scripts/**/*.{js,cjs,mjs,ts}'],
  rules: {
    'no-console': 'off'
  }
};

export const sharedConfig = [
  ignores,
  javascriptConfig,
  typescriptConfig,
  backendConfig,
  frontendConfig,
  frontendTemplateConfig,
  ...astroConfig,
  testsConfig,
  astroVirtualFileConfig,
  scriptConfig,
  eslintConfigPrettier
];

export const backendLintConfig = [
  ignores,
  javascriptConfig,
  {
    ...typescriptConfig,
    files: ['come-pouco-backend/**/*.ts']
  },
  backendConfig,
  testsConfig,
  scriptConfig,
  eslintConfigPrettier
];

export const frontendLintConfig = [
  ignores,
  {
    ...typescriptConfig,
    files: ['come-pouco-frontend/**/*.ts']
  },
  frontendConfig,
  frontendTemplateConfig,
  testsConfig,
  eslintConfigPrettier
];

export const landingLintConfig = [
  ignores,
  javascriptConfig,
  {
    ...typescriptConfig,
    files: ['come-pouco-landing/**/*.ts']
  },
  ...astroConfig,
  astroVirtualFileConfig,
  eslintConfigPrettier
];

export default sharedConfig;
