import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { msw } from 'msw/vite';
import { defineConfig } from 'vite';

/**
 * FE-01 D1/D8/D10.
 *
 * `VITE_API_BASE_URL` is the only build-time input in phase 1 and it is not a
 * secret (docs/phase-1/README.md §7). No other variable is read here, so no
 * secret can reach the bundle.
 *
 * The Mock Service Worker plugin serves the worker script in development only.
 * `src/mocks/network.ts` imports `virtual:msw` behind an `import.meta.env.DEV`
 * guard, so a production build drops both the import and the worker script.
 */
export default defineConfig({
  // The repository keeps one `.env` at the root (docs/phase-1/README.md §7).
  // Vite exposes only `VITE_`-prefixed variables to the client, so no
  // secret-bearing variable in that file can reach the bundle.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react(), tailwindcss(), msw()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // A stack trace must never be the user-facing error surface (FE-01 §8), and
    // a source map served in production is an avoidable information leak.
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
