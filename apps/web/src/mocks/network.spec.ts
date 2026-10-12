import { describe, expect, it } from 'vitest';

import { enableMocks, mocksRequested } from './network';

/** FE-01 §9 — "a disabled flag produces no interception". */
describe('mock gate', () => {
  it('is off outside the explicit mock mode', async () => {
    // Vitest runs in mode "test", which is not "mock".
    expect(mocksRequested()).toBe(false);
    await expect(enableMocks()).resolves.toBeNull();
  });
});
