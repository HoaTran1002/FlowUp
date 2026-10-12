import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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

  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
