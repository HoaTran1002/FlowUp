import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../../../prisma/generated/client/client';

/**
 * The single Prisma client, shared by `apps/api`, `apps/dispatcher` and
 * `apps/worker` (TECHNICAL_DESIGN.md §2 — migrations and client are
 * centralized, not generated per executable).
 *
 * The connection pool is sized per process from `DATABASE_POOL_SIZE`
 * (TECHNICAL_DESIGN.md §10): api, dispatcher and worker each read their own
 * value, so they can be sized independently without a schema or code change.
 */
export interface PrismaServiceOptions {
  readonly databaseUrl: string;
  readonly poolSize: number;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(options: PrismaServiceOptions) {
    super({
      adapter: new PrismaPg({
        connectionString: options.databaseUrl,
        max: options.poolSize,
      }),
    });
  }

  /** Cheap authoritative round-trip used by readiness. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  /**
   * True when at least one migration has been applied and none is in a failed
   * or rolled-back state. Readiness must not report ready against a database
   * whose schema was never migrated (BE-01 §6.1).
   */
  async migrationsApplied(): Promise<boolean> {
    const rows = await this.$queryRaw<{ applied: bigint; broken: bigint }[]>`
      SELECT
        count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
        count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) AS broken
      FROM "_prisma_migrations"
    `;
    const row = rows[0];
    if (row === undefined) return false;
    return row.applied > 0n && row.broken === 0n;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
