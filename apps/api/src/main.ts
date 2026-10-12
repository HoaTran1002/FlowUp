import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  FLOWUP_CONFIG,
  Logger,
  NestLoggerBridge,
  createLogger,
  installGracefulShutdown,
  parseEnv,
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
async function bootstrap(): Promise<void> {
  // A bootstrap logger exists before the DI container does, so that a failure
  // inside NestFactory.create is still reported as a structured record.
  const parsed = parseEnv('api');
  const bootstrapLogger = createLogger({
    role: 'api',
    level: parsed.ok ? parsed.config.LOG_LEVEL : 'info',
  }).child({ worker_id: 'api' });

  // `bodyParser: false` so the limit below is the only JSON parser configured.
  // Nest's own logger is bridged into the structured logger rather than
  // disabled: `console.*` is banned, but silencing Nest would also silence its
  // fatal diagnostics (BE-01 §2.4, §3.2).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: new NestLoggerBridge(bootstrapLogger),
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
}

bootstrap().catch((caught: unknown) => {
  // The logger may not exist yet, so this path writes the record directly.
  process.stderr.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      level: 'error',
      process: 'api',
      msg: 'bootstrap failed',
      error_category: caught instanceof Error ? caught.constructor.name : typeof caught,
    })}\n`,
  );
  process.exitCode = 1;
});
