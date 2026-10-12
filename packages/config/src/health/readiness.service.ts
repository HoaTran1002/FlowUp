import { Injectable } from '@nestjs/common';

import type {
  HealthResponse,
  ProcessRole,
  ReadinessResponse,
  ReadinessCheckStatus,
} from '@flowup/contracts';

import { Logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../queue/redis.service';

/**
 * Liveness and readiness for every process (BE-01 §6).
 *
 * Liveness answers "is this process up" and makes no dependency call.
 * Readiness answers "can this process do its job right now": PostgreSQL
 * reachable, Redis reachable, migrations applied. Readiness turning unhealthy
 * must NOT crash the process — a Redis outage degrades readiness and nothing
 * more (INV-03).
 */
/**
 * Per-check deadline. A readiness probe that hangs is worse than one that
 * reports `down`: an orchestrator reads the timeout as a failure anyway, but a
 * hanging probe also holds the connection open.
 */
export const READINESS_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class ReadinessService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly role: ProcessRole,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: Logger,
  ) {}

  health(): HealthResponse {
    return {
      status: 'ok',
      process: this.role,
      uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  async readiness(): Promise<ReadinessResponse> {
    const [database, migrations, redis] = await Promise.all([
      this.check('database', () => this.prisma.ping()),
      this.check('migrations', async () => {
        if (!(await this.prisma.migrationsApplied())) {
          throw new Error('migrations not applied');
        }
      }),
      this.check('redis', () => this.redis.ping()),
    ]);

    const checks = { database, redis, migrations };
    const ready = Object.values(checks).every((status) => status === 'up');

    return { status: ready ? 'ready' : 'not_ready', process: this.role, checks };
  }

  private async check(name: string, probe: () => Promise<void>): Promise<ReadinessCheckStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        probe(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error('readiness check timed out'));
          }, READINESS_CHECK_TIMEOUT_MS);
        }),
      ]);
      return 'up';
    } catch (caught) {
      this.logger.errorCaught('readiness check failed', caught, { check: name });
      return 'down';
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
