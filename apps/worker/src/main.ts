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
  type WorkerEnv,
} from '@flowup/config';

import { AppModule } from './app.module';

/**
 * `apps/worker` — a NestJS APPLICATION CONTEXT, not an HTTP server
 * (SYSTEM_ARCHITECTURE.md §3). It boots, validates configuration, connects to
 * PostgreSQL and Redis, exposes health and readiness, reads
 * `WORKER_CONCURRENCY` without consuming any job yet, and shuts down
 * gracefully.
 */
async function bootstrap(): Promise<void> {
  const parsed = parseEnv('worker');
  const bootstrapLogger = createLogger({
    role: 'worker',
    level: parsed.ok ? parsed.config.LOG_LEVEL : 'info',
  }).child({ worker_id: 'worker' });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new NestLoggerBridge(bootstrapLogger),
  });
  app.enableShutdownHooks();

  const config = app.get<WorkerEnv>(FLOWUP_CONFIG);
  const logger = app.get(Logger);
  const readiness = app.get(ReadinessService);

  const probe = await startProbeServer({
    port: config.WORKER_PROBE_PORT,
    logger,
    health: () => readiness.health(),
    readiness: () => readiness.readiness(),
  });

  installGracefulShutdown({
    role: 'worker',
    logger,
    close: async () => {
      await probe.close();
      await app.close();
    },
  });

  // The bound concurrency is read and reported now; no job is consumed until
  // BE-09 adds the processor.
  logger.info('worker started', {
    port: probe.port,
    concurrency: config.WORKER_CONCURRENCY,
  });
}

bootstrap().catch((caught: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      level: 'error',
      process: 'worker',
      msg: 'bootstrap failed',
      error_category: caught instanceof Error ? caught.constructor.name : typeof caught,
    })}\n`,
  );
  process.exitCode = 1;
});
