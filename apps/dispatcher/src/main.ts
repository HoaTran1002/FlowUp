import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import {
  NestLoggerBridge,
  createBootstrapLogger,
  runBootstrap,
  startProbedProcess,
  type DispatcherEnv,
} from '@flowup/config';

import { AppModule } from './app.module';

/**
 * `apps/dispatcher` — a NestJS APPLICATION CONTEXT, not an HTTP server
 * (SYSTEM_ARCHITECTURE.md §3). It boots, validates configuration, connects to
 * PostgreSQL and Redis, exposes health and readiness on a minimal probe
 * listener, logs its process identity, and shuts down gracefully.
 */
runBootstrap('dispatcher', async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new NestLoggerBridge(createBootstrapLogger('dispatcher')),
  });

  const { config, logger, probe } = await startProbedProcess<DispatcherEnv>({
    role: 'dispatcher',
    app,
    probePort: (c) => c.DISPATCHER_PROBE_PORT,
  });

  logger.info('dispatcher started', {
    port: probe.port,
    poll_interval_ms: config.DISPATCHER_POLL_INTERVAL_MS,
  });
});
