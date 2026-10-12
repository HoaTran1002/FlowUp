import { describe, expect, it } from 'vitest';

import { readEnv } from './env';

function source(overrides: Partial<ImportMetaEnv>): ImportMetaEnv {
  return { MODE: 'test', DEV: false, PROD: false, SSR: false, BASE_URL: '/', ...overrides };
}

describe('readEnv', () => {
  it('fails loudly when VITE_API_BASE_URL is missing', () => {
    expect(() => readEnv(source({}))).toThrow(/VITE_API_BASE_URL is required/);
  });

  it('fails on a blank value', () => {
    expect(() => readEnv(source({ VITE_API_BASE_URL: '   ' }))).toThrow(/required/);
  });

  it('fails on a value that is not an absolute URL', () => {
    expect(() => readEnv(source({ VITE_API_BASE_URL: 'localhost:3000' }))).toThrow();
    expect(() => readEnv(source({ VITE_API_BASE_URL: '/relative' }))).toThrow(/absolute URL/);
  });

  it('rejects a non-http scheme', () => {
    expect(() => readEnv(source({ VITE_API_BASE_URL: 'ftp://example.com' }))).toThrow(
      /http or https/,
    );
  });

  it('normalizes away a trailing slash', () => {
    expect(readEnv(source({ VITE_API_BASE_URL: 'https://api.example.com/' })).apiBaseUrl).toBe(
      'https://api.example.com',
    );
  });
});
