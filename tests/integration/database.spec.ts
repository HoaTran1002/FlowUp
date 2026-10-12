import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PrismaService } from '@flowup/config';

import { migrateDeploy, recreateTestDatabase } from './support/compose';

/**
 * Database integration (BE-01 §8): the migration applies to a fresh database,
 * re-running is a no-op, Prisma connects, and the per-process pool size is
 * respected. PostgreSQL is never mocked here.
 */
let databaseUrl: string;
let prisma: PrismaService;

beforeAll(async () => {
  databaseUrl = await recreateTestDatabase();
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migrations', () => {
  it('applies cleanly to a fresh database', async () => {
    const result = await migrateDeploy(databaseUrl);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('migration');
  }, 60_000);

  it('is a no-op when re-run', async () => {
    const result = await migrateDeploy(databaseUrl);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No pending migrations to apply');
  }, 60_000);
});

describe('PrismaService', () => {
  it('connects and answers the readiness ping', async () => {
    prisma = new PrismaService({ databaseUrl, poolSize: 5 });
    // Resolving at all is the assertion: ping() throws when PostgreSQL is
    // unreachable.
    await prisma.ping();
    expect(await prisma.migrationsApplied()).toBe(true);
  });

  it('reports migrations as applied', async () => {
    expect(await prisma.migrationsApplied()).toBe(true);
  });

  it('round-trips the infrastructure-only metadata table', async () => {
    await prisma.schemaMetadata.create({ data: { key: 'integration', value: 'be-01' } });
    const row = await prisma.schemaMetadata.findUnique({ where: { key: 'integration' } });
    expect(row?.value).toBe('be-01');
    expect(row?.updatedAt).toBeInstanceOf(Date);

    await prisma.schemaMetadata.delete({ where: { key: 'integration' } });
    expect(await prisma.schemaMetadata.findUnique({ where: { key: 'integration' } })).toBeNull();
  });

  it('contains no business table yet', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const names = tables.map((row) => row.table_name).toSorted();

    // BE-03 owns the business schema; BE-01 must not pre-create any of it.
    expect(names).toEqual(['_prisma_migrations', 'schema_metadata']);
  });

  it('respects the configured connection pool size', async () => {
    // With a pool of one, two concurrent server-side sleeps cannot overlap.
    const single = new PrismaService({ databaseUrl, poolSize: 1 });
    try {
      const startedAt = Date.now();
      await Promise.all([
        single.$queryRaw`SELECT pg_sleep(0.4)::text`,
        single.$queryRaw`SELECT pg_sleep(0.4)::text`,
      ]);
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(800);
    } finally {
      await single.$disconnect();
    }

    // With a larger pool they do overlap.
    const parallel = new PrismaService({ databaseUrl, poolSize: 4 });
    try {
      const startedAt = Date.now();
      await Promise.all([
        parallel.$queryRaw`SELECT pg_sleep(0.4)::text`,
        parallel.$queryRaw`SELECT pg_sleep(0.4)::text`,
      ]);
      expect(Date.now() - startedAt).toBeLessThan(800);
    } finally {
      await parallel.$disconnect();
    }
  }, 30_000);
});
