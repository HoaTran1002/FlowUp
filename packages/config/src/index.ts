/**
 * `@flowup/config` — the shared backend infrastructure package
 * (TECHNICAL_DESIGN.md §1: "env schema, shared telemetry config").
 *
 * It owns the four things all three processes must agree on: the validated
 * environment, the structured logger and its redaction layer, the single
 * Prisma client, and the Redis/BullMQ connection factory. Nothing here makes
 * a business decision.
 */
export * from './core/core.module';
export * from './core/shutdown';
export * from './core/tokens';
export * from './env/load';
export * from './env/schema';
export * from './health/readiness.service';
export * from './logging/fields';
export * from './logging/logger';
export * from './logging/nest-logger';
export * from './logging/redaction';
export * from './logging/request-id';
export * from './prisma/prisma.service';
export * from './probe/probe-server';
export * from './queue/redis.service';
