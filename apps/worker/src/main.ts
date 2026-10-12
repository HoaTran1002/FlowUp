import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import {
  NestLoggerBridge,
  createBootstrapLogger,
  runBootstrap,
  startProbedProcess,
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
runBootstrap('worker', async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new NestLoggerBridge(createBootstrapLogger('worker')),
  });

  const { config, logger, probe } = await startProbedProcess<WorkerEnv>({
    role: 'worker',
    app,
    probePort: (c) => c.WORKER_PROBE_PORT,
  });

  // The bound concurrency is read and reported now; no job is consumed until
  // BE-09 adds the processor.
  logger.info('worker started', { port: probe.port, concurrency: config.WORKER_CONCURRENCY });
});
