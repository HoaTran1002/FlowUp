import { Global, Module, type DynamicModule } from '@nestjs/common';

import type { ProcessRole } from '@flowup/contracts';

import { ReadinessService } from '../health/readiness.service';
import { loadEnvOrExit } from '../env/load';
import { Logger, createLogger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../queue/redis.service';
import { FLOWUP_CONFIG, FLOWUP_PROCESS_ROLE } from './tokens';

/**
 * The one shared infrastructure module for all three processes (BE-01 D2, D9).
 *
 * It parses the environment ONCE at bootstrap and fails fast, then exposes a
 * typed, frozen configuration object plus the logger, the Prisma client, the
 * Redis connection factory and readiness through NestJS DI.
 */
@Global()
@Module({})
export class FlowUpCoreModule {
  static forRole(role: ProcessRole): DynamicModule {
    // Parsed here, at module construction, so an invalid environment stops the
    // process before any connection is opened (TECHNICAL_DESIGN.md §10).
    const config = loadEnvOrExit(role);

    return {
      module: FlowUpCoreModule,
      providers: [
        { provide: FLOWUP_PROCESS_ROLE, useValue: role },
        { provide: FLOWUP_CONFIG, useValue: config },
        {
          provide: Logger,
          useFactory: () =>
            createLogger({ role, level: config.LOG_LEVEL }).child({ worker_id: role }),
        },
        {
          provide: PrismaService,
          useFactory: () =>
            new PrismaService({
              databaseUrl: config.DATABASE_URL,
              poolSize: config.DATABASE_POOL_SIZE,
            }),
        },
        { provide: RedisService, useFactory: () => new RedisService(config.REDIS_URL) },
        {
          provide: ReadinessService,
          useFactory: (prisma: PrismaService, redis: RedisService, logger: Logger) =>
            new ReadinessService(role, prisma, redis, logger),
          inject: [PrismaService, RedisService, Logger],
        },
      ],
      exports: [
        FLOWUP_PROCESS_ROLE,
        FLOWUP_CONFIG,
        Logger,
        PrismaService,
        RedisService,
        ReadinessService,
      ],
    };
  }
}
