import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * One shared base configuration for the whole repository (BE-01 §2.4).
 *
 * The four rules the task specification requires are marked below. They are
 * errors, not warnings: a warning is not enforcement.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'prisma/generated/**',
      'prisma/migrations/**',
      'bun.lock',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Type-aware linting; `no-floating-promises` cannot work without it.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // (1) No floating promises. An unawaited promise in a delivery pipeline
      // loses work silently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // (2) Explicit module boundaries. A public function's types are part of
      // the contract and are never inferred.
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // (3) No default exports in application modules (BE-01 §2.4). Named
      // exports keep module boundaries greppable and re-exports honest. Build
      // tooling that *requires* a default export is exempted below.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Default exports are not used in FlowUp; export a named symbol.',
        },
      ],

      // (4) No `console.*` in application code. Logging goes through the
      // structured logger so that redaction and the field contract apply
      // (BE-01 §3.2, INV-08).
      'no-console': 'error',

      // Supporting rules for the standards in AGENTS.md §6.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      eqeqeq: ['error', 'always'],
      'no-param-reassign': 'error',
    },
  },

  {
    // NestJS modules are declarative: an empty or static-only class decorated
    // with @Module IS the unit of composition. `no-extraneous-class` is a
    // false positive against the framework's own idiom.
    files: ['**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  {
    // Tooling configuration files are loaded by their tools, which require a
    // default export. They contain no application logic.
    files: ['eslint.config.mjs', 'prisma.config.ts', '**/vite.config.ts', '**/vitest.config.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // Frontend / backend boundary (README.md §3).
  //
  // The two sides meet only in `packages/contracts` and over HTTP. These are
  // errors, not conventions: a React component importing Prisma, or a NestJS
  // service importing React, is rejected at lint time.
  // ---------------------------------------------------------------------------
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flowup/config',
                '@flowup/config/*',
                '@nestjs/*',
                '@prisma/*',
                'prisma',
                'bullmq',
                'ioredis',
                'pg',
                'express',
                'body-parser',
                'class-validator',
                'class-transformer',
              ],
              message: 'Frontend code must not import backend-only packages (README.md §3).',
            },
            {
              group: ['**/apps/api/**', '**/apps/dispatcher/**', '**/apps/worker/**'],
              message: 'Frontend code must not import backend application code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/api/**/*.ts',
      'apps/dispatcher/**/*.ts',
      'apps/worker/**/*.ts',
      'packages/config/**/*.ts',
      'tests/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react-dom/*',
                'react/*',
                '@tanstack/*',
                'axios',
                'msw',
                'msw/*',
                'lucide-react',
                'sonner',
              ],
              message: 'Backend code must not import frontend-only packages (README.md §3).',
            },
            {
              group: ['**/apps/web/**', '@flowup/web'],
              message: 'Backend code must not import frontend application code.',
            },
          ],
        },
      ],
    },
  },
  {
    // The shared contract package is a leaf: it may depend on `zod` only, so
    // neither side can leak into the other through it.
    files: ['packages/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@flowup/config', '@flowup/config/*', '**/apps/**'],
              message: 'packages/contracts is shared and may depend on zod only.',
            },
            {
              group: ['@nestjs/*', '@prisma/*', 'react', 'react-dom', '@tanstack/*', 'axios'],
              message: 'packages/contracts is shared and may depend on zod only.',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Frontend-specific rules (FE-01).
  // ---------------------------------------------------------------------------
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // apps/web/AGENTS.md §4.5: API-supplied HTML is never rendered.
      'no-restricted-properties': [
        'error',
        { property: 'dangerouslySetInnerHTML', message: 'Never render API-supplied HTML.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Default exports are not used in FlowUp; export a named symbol.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Never render API-supplied HTML (apps/web/AGENTS.md §4.5).',
        },
      ],
    },
  },
  {
    // Tooling configs are loaded by their tools, which require a default export.
    files: ['apps/web/vite.config.ts', 'apps/web/vitest.config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Vitest files import test APIs and use framework idioms.
    files: ['apps/web/**/*.spec.{ts,tsx}', 'apps/web/src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
