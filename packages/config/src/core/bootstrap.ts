import type { INestApplicationContext } from '@nestjs/common';

import type { ProcessRole } from '@flowup/contracts';

import { parseEnv } from '../env/load';
import { Logger, createLogger } from '../logging/logger';
import { ReadinessService } from '../health/readiness.service';
import { startProbeServer, type ProbeServerHandle } from '../probe/probe-server';
import { installGracefulShutdown } from './shutdown';
import { FLOWUP_CONFIG } from './tokens';

/**
 * Shared bootstrap steps for the three backend processes (BE-01 D4–D6).
 *
 * `apps/api`, `apps/dispatcher` and `apps/worker` differ in what they listen
 * on, never in how they report a failed start or wire probes and shutdown, so
 * those steps live here once.
 */

/**
 * A logger that exists before the DI container does, so a failure inside
 * `NestFactory.create*` is still a structured record. Falls back to `info`
 * when the environment is invalid; the real validation error is reported by
 * `loadEnvOrExit` when the core module is constructed.
 */
export function createBootstrapLogger(role: ProcessRole): Logger {
  const parsed = parseEnv(role);
  return createLogger({ role, level: parsed.ok ? parsed.config.LOG_LEVEL : 'info' }).child({
    worker_id: role,
  });
}

/**
 * Runs a bootstrap function and, on failure, writes one structured record with
 * a sanitized category (never the message) and sets a non-zero exit code. The
 * DI logger may not exist yet, so this writes to stderr directly.
 */
export function runBootstrap(role: ProcessRole, bootstrap: () => Promise<void>): void {
  bootstrap().catch((caught: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        time: new Date().toISOString(),
        level: 'error',
        process: role,
        msg: 'bootstrap failed',
        error_category: caught instanceof Error ? caught.constructor.name : typeof caught,
      })}\n`,
    );
    process.exitCode = 1;
  });
}

export interface ProbedProcess<TConfig> {
  readonly config: Readonly<TConfig>;
  readonly logger: Logger;
  readonly probe: ProbeServerHandle;
}

/**
 * Wires an application context (dispatcher, worker) to the probe listener and
 * graceful shutdown: probes stop answering first, then Nest runs
 * `onModuleDestroy`, which disconnects Prisma and Redis.
 */
export async function startProbedProcess<TConfig>(options: {
  readonly role: ProcessRole;
  readonly app: INestApplicationContext;
  readonly probePort: (config: Readonly<TConfig>) => number;
}): Promise<ProbedProcess<TConfig>> {
  const { role, app } = options;
  app.enableShutdownHooks();

  const config = app.get<Readonly<TConfig>>(FLOWUP_CONFIG);
  const logger = app.get(Logger);
  const readiness = app.get(ReadinessService);

  const probe = await startProbeServer({
    port: options.probePort(config),
    logger,
    health: () => readiness.health(),
    readiness: () => readiness.readiness(),
  });

  installGracefulShutdown({
    role,
    logger,
    close: async () => {
      await probe.close();
      await app.close();
    },
  });

  return { config, logger, probe };
}
