import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  FLOWUP_CONFIG,
  Logger,
  NestLoggerBridge,
  createBootstrapLogger,
  installGracefulShutdown,
  runBootstrap,
  type ApiEnv,
} from '@flowup/config';

import { AppModule } from './app.module';
import { ErrorEnvelopeFilter } from './http/error-envelope.filter';

/**
 * `apps/api` — the NestJS HTTP process (SYSTEM_ARCHITECTURE.md §3).
 *
 * It never performs a downstream webhook call: delivery belongs to
 * `apps/worker` (AGENTS.md §6.1).
 */
runBootstrap('api', async () => {
  // `bodyParser: false` so the limit below is the only JSON parser configured.
  // Nest's own logger is bridged into the structured logger rather than
  // disabled: `console.*` is banned, but silencing Nest would also silence its
  // fatal diagnostics (BE-01 §2.4, §3.2).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: new NestLoggerBridge(createBootstrapLogger('api')),
  });

  const config = app.get<ApiEnv>(FLOWUP_CONFIG);
  const logger = app.get(Logger);

  /**
   * Body size limit (BE-01 §6.1). `413` is produced by CONFIGURATION, not by
   * ad hoc code in a handler. The exact ceiling is ADR-04-dependent; the
   * default is the documented pilot proposal of 256 KiB
   * (SYSTEM_ARCHITECTURE.md §8) and is not final.
   */
  app.useBodyParser('json', { limit: config.PUBLISH_MAX_BODY_BYTES });

  // Later DTOs are validated at the boundary by default (apps/api/AGENTS.md §3.5).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ErrorEnvelopeFilter(logger));

  // Public routes live under `/v1`. Health and readiness are an operational
  // contract and stay outside it (BE-01 §6.1).
  app.setGlobalPrefix('v1', { exclude: ['health', 'ready'] });

  installGracefulShutdown({
    role: 'api',
    logger,
    close: async () => {
      // Stops accepting new connections, then lets Nest run onModuleDestroy,
      // which disconnects Prisma and Redis.
      await app.close();
    },
  });

  await app.listen(config.API_PORT);
  logger.info('api listening', { port: config.API_PORT });
});
