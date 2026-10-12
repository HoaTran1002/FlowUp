import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import {
  FLOWUP_CONFIG,
  Logger,
  NestLoggerBridge,
  ReadinessService,
  createLogger,
  installGracefulShutdown,
  parseEnv,
  startProbeServer,
  type DispatcherEnv,
} from '@flowup/config';

import { AppModule } from './app.module';

/**
 * `apps/dispatcher` — a NestJS APPLICATION CONTEXT, not an HTTP server
 * (SYSTEM_ARCHITECTURE.md §3). It boots, validates configuration, connects to
 * PostgreSQL and Redis, exposes health and readiness on a minimal probe
 * listener, logs its process identity, and shuts down gracefully.
 */
async function bootstrap(): Promise<void> {
  const parsed = parseEnv('dispatcher');
  const bootstrapLogger = createLogger({
    role: 'dispatcher',
    level: parsed.ok ? parsed.config.LOG_LEVEL : 'info',
  }).child({ worker_id: 'dispatcher' });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new NestLoggerBridge(bootstrapLogger),
  });
  app.enableShutdownHooks();

  const config = app.get<DispatcherEnv>(FLOWUP_CONFIG);
  const logger = app.get(Logger);
  const readiness = app.get(ReadinessService);

  const probe = await startProbeServer({
    port: config.DISPATCHER_PROBE_PORT,
    logger,
    health: () => readiness.health(),
    readiness: () => readiness.readiness(),
  });

  installGracefulShutdown({
    role: 'dispatcher',
    logger,
    close: async () => {
      // Stop answering probes first, then let Nest disconnect Prisma and Redis.
      await probe.close();
      await app.close();
    },
  });

  logger.info('dispatcher started', {
    port: probe.port,
    poll_interval_ms: config.DISPATCHER_POLL_INTERVAL_MS,
  });
}

bootstrap().catch((caught: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      level: 'error',
      process: 'dispatcher',
      msg: 'bootstrap failed',
      error_category: caught instanceof Error ? caught.constructor.name : typeof caught,
    })}\n`,
  );
  process.exitCode = 1;
});
