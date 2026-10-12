import { env } from '@/env';

/**
 * FE-01 D8 — the only entry point that can turn interception on.
 *
 * Mocks are enabled when ALL of these hold, and never otherwise:
 *   1. this is a Vite development server (`import.meta.env.DEV`), and
 *   2. the explicit `mock` mode was requested (`bun run dev` → `vite --mode mock`).
 *
 * `import.meta.env.DEV` is a compile-time constant, so a production build
 * eliminates the dynamic import below along with the worker script and every
 * handler: there is nothing left to enable (FE-01 §9). The flag is a Vite
 * mode, not a `VITE_*` variable, so phase 1 keeps `VITE_API_BASE_URL` as its
 * only build-time input.
 */
export function mocksRequested(): boolean {
  return import.meta.env.DEV && env.mode === 'mock';
}

/**
 * Starts interception and returns the mock organization name, or `null` when
 * mocks are not enabled. The name is returned from here, rather than imported
 * by the caller, so that no fixture is reachable from production code.
 */
export async function enableMocks(): Promise<string | null> {
  if (!mocksRequested()) {
    return null;
  }

  const [{ network }, { handlers }, { MOCK_ORGANIZATION_NAME }] = await Promise.all([
    import('virtual:msw'),
    import('./handlers'),
    import('./fixtures'),
  ]);

  network.configure({ handlers });
  await network.enable();
  return MOCK_ORGANIZATION_NAME;
}
