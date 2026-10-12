import { describe, expect, it } from 'bun:test';
import { healthResponseSchema, readinessResponseSchema } from '@flowup/contracts';

import { createLogger } from '../logging/logger';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../queue/redis.service';
import { ReadinessService } from './readiness.service';

/**
 * Contract test (BE-01 §8): the health and readiness responses every process
 * returns must satisfy the shapes exported from `@flowup/contracts`. No
 * database or Redis is involved, so this runs without Docker.
 */
interface Stubs {
  databaseUp?: boolean;
  migrationsApplied?: boolean;
  redisUp?: boolean;
}

function service({
  databaseUp = true,
  migrationsApplied = true,
  redisUp = true,
}: Stubs = {}): ReadinessService {
  const prisma = {
    ping: () => (databaseUp ? Promise.resolve() : Promise.reject(new Error('down'))),
    migrationsApplied: () => Promise.resolve(migrationsApplied),
  } as unknown as PrismaService;

  const redis = {
    ping: () => (redisUp ? Promise.resolve() : Promise.reject(new Error('down'))),
  } as unknown as RedisService;

  return new ReadinessService(
    'api',
    prisma,
    redis,
    createLogger({ role: 'api', level: 'error', write: () => undefined }),
  );
}

describe('health and readiness contracts', () => {
  it('returns a liveness response matching the contract', () => {
    const body = service().health();
    expect(healthResponseSchema.parse(body)).toEqual(body);
    expect(body.status).toBe('ok');
  });

  it('returns a ready response matching the contract when every check is up', async () => {
    const body = await service().readiness();
    expect(readinessResponseSchema.parse(body)).toEqual(body);
    expect(body).toEqual({
      status: 'ready',
      process: 'api',
      checks: { database: 'up', redis: 'up', migrations: 'up' },
    });
  });

  it('reports not_ready when PostgreSQL is unreachable', async () => {
    const body = await service({ databaseUp: false }).readiness();
    expect(readinessResponseSchema.parse(body)).toEqual(body);
    expect(body.status).toBe('not_ready');
    expect(body.checks.database).toBe('down');
  });

  it('reports not_ready when Redis is unreachable, without throwing', async () => {
    const body = await service({ redisUp: false }).readiness();
    expect(body.status).toBe('not_ready');
    expect(body.checks.redis).toBe('down');
    // A Redis outage degrades readiness only; it must not crash the process.
    expect(body.checks.database).toBe('up');
  });

  it('reports not_ready when migrations were never applied', async () => {
    const body = await service({ migrationsApplied: false }).readiness();
    expect(body.status).toBe('not_ready');
    expect(body.checks.migrations).toBe('down');
  });
});
