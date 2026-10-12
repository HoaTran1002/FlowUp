import { describe, expect, it } from 'bun:test';

import { parseEnv } from './load';
import { SECRET_BEARING_VARIABLES } from './schema';

const VALID_API_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://user:s3cr3t-password@db:5432/flowup?schema=public',
  DATABASE_POOL_SIZE: '7',
  REDIS_URL: 'redis://cache:6379',
  API_PORT: '3000',
  API_BASE_URL: 'http://localhost:3000',
  PUBLISH_MAX_BODY_BYTES: '262144',
  SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('parseEnv', () => {
  it('accepts a valid api environment and coerces numbers', () => {
    const result = parseEnv('api', VALID_API_ENV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.DATABASE_POOL_SIZE).toBe(7);
    expect(result.config.API_PORT).toBe(3000);
  });

  it('freezes the configuration object', () => {
    const result = parseEnv('api', VALID_API_ENV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.config)).toBe(true);
  });

  it('applies the documented pilot-proposal defaults when a limit is absent', () => {
    const { DATABASE_POOL_SIZE, PUBLISH_MAX_BODY_BYTES, ...withoutLimits } = VALID_API_ENV;
    expect(DATABASE_POOL_SIZE).toBeDefined();
    expect(PUBLISH_MAX_BODY_BYTES).toBeDefined();

    const result = parseEnv('api', withoutLimits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ADR-04 pending: 256 KiB is the proposal, carried as configuration.
    expect(result.config.PUBLISH_MAX_BODY_BYTES).toBe(262144);
    expect(result.config.DATABASE_POOL_SIZE).toBe(10);
  });

  it('fails and names every invalid variable', () => {
    const result = parseEnv('api', {
      ...VALID_API_ENV,
      DATABASE_URL: 'mysql://nope',
      API_PORT: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.variables).toEqual(['API_PORT', 'DATABASE_URL']);
  });

  it('reports a missing required variable by name', () => {
    const { DATABASE_URL, ...withoutDatabase } = VALID_API_ENV;
    expect(DATABASE_URL).toBeDefined();

    const result = parseEnv('api', withoutDatabase);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.variables).toContain('DATABASE_URL');
  });

  it('never includes a rejected value in the failure report', () => {
    const secret = 'postgresql://user:LEAKED-PASSWORD@db:5432/flowup';
    const result = parseEnv('api', {
      ...VALID_API_ENV,
      // Valid prefix, but the pool size is what fails; the URL is still
      // present in the source object the parser saw.
      DATABASE_URL: secret,
      DATABASE_POOL_SIZE: '0',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const serialized = JSON.stringify(result.failure);
    expect(serialized).not.toContain('LEAKED-PASSWORD');
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(VALID_API_ENV.SECRET_ENCRYPTION_KEY);
  });

  it('validates SECRET_ENCRYPTION_KEY length only, and rejects a short key', () => {
    const result = parseEnv('api', {
      ...VALID_API_ENV,
      SECRET_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.variables).toEqual(['SECRET_ENCRYPTION_KEY']);
    expect(JSON.stringify(result.failure)).not.toContain(Buffer.alloc(16, 1).toString('base64'));
  });

  it('requires the dispatcher and worker roles to carry their own schema', () => {
    expect(parseEnv('dispatcher', VALID_API_ENV).ok).toBe(true);

    const worker = parseEnv('worker', VALID_API_ENV);
    expect(worker.ok).toBe(true);
    if (!worker.ok) return;
    expect(worker.config.WORKER_CONCURRENCY).toBe(5);
    expect(worker.config.DELIVERY_MAX_ATTEMPTS).toBe(5);
  });

  it('declares the secret-bearing variables', () => {
    expect([...SECRET_BEARING_VARIABLES]).toEqual([
      'DATABASE_URL',
      'REDIS_URL',
      'SECRET_ENCRYPTION_KEY',
    ]);
  });
});
