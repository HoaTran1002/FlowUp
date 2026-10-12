import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

/**
 * FE-01 D9. Unit, component and mocked-API tests run in jsdom against the same
 * Vite pipeline the application uses, so `import.meta.env` and the `@/` alias
 * behave identically in tests and in the browser.
 *
 * Browser E2E is FE-10 and is deliberately absent here.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // Tests must not depend on a developer's local `.env`: CI runs on a clean
      // checkout. The value is a non-secret placeholder origin.
      env: { VITE_API_BASE_URL: 'http://localhost:3000' },
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
      restoreMocks: true,
    },
  }),
);
