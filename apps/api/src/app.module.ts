import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { FlowUpCoreModule } from '@flowup/config';

import { HealthController } from './health/health.controller';
import { CorrelationMiddleware } from './http/correlation.middleware';

/**
 * The `api` process root module.
 *
 * Phase 1 wires infrastructure and the operational probes only. There is NO
 * authentication module and no `/v1` business route: `AuthModule` is BE-02 and
 * is blocked by ADR-01 (docs/phase-1/README.md §5). No guard placeholder is
 * registered, because an unregistered guard cannot be mistaken for an
 * implemented access control.
 */
@Module({
  imports: [FlowUpCoreModule.forRole('api')],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 / path-to-regexp 8 wildcard syntax: every path, including the
    // probes, gets a correlation id.
    consumer.apply(CorrelationMiddleware).forRoutes('{*path}');
  }
}
