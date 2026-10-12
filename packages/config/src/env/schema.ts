import { z } from 'zod';

import type { ProcessRole } from '@flowup/contracts';

/**
 * The environment contract (docs/phase-1/README.md §7), as one Zod schema per
 * process role (TECHNICAL_DESIGN.md §10).
 *
 * Rules enforced here:
 *  - A process refuses to start on invalid configuration.
 *  - A variable's VALUE is never logged. `DATABASE_URL`, `REDIS_URL` and
 *    `SECRET_ENCRYPTION_KEY` are secret-bearing (INV-08).
 *  - ADR-04 is unresolved. Every limit it governs is carried as configuration
 *    with the documented pilot proposal (SYSTEM_ARCHITECTURE.md §8) as its
 *    default. None of these values is final.
 */

const integerFromString = (field: { min: number; max: number }) =>
  z
    .string()
    .regex(/^\d+$/, 'must be a non-negative integer')
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => value >= field.min && value <= field.max, {
      message: `must be between ${String(field.min)} and ${String(field.max)}`,
    });

const httpUrl = z
  .url()
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: 'must be an http(s) URL',
  });

const postgresUrl = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
    message: 'must be a postgres:// or postgresql:// connection string',
  });

const redisUrl = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
    message: 'must be a redis:// or rediss:// connection string',
  });

/**
 * Master key for endpoint signing secrets (BE-06).
 *
 * Phase 1 validates presence and decoded length only; it is not used to
 * encrypt anything yet. The value is never logged or echoed.
 */
export const SECRET_ENCRYPTION_KEY_BYTES = 32;

const secretEncryptionKey = z
  .string()
  .min(1)
  .refine(
    (value) => {
      try {
        return Buffer.from(value, 'base64').length === SECRET_ENCRYPTION_KEY_BYTES;
      } catch {
        return false;
      }
    },
    {
      message: `must be ${String(SECRET_ENCRYPTION_KEY_BYTES)} bytes, base64-encoded`,
    },
  );

const commonShape = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
};

const dataStoreShape = {
  DATABASE_URL: postgresUrl,
  DATABASE_POOL_SIZE: integerFromString({ min: 1, max: 100 }).default(10),
  REDIS_URL: redisUrl,
};

export const apiEnvSchema = z.object({
  ...commonShape,
  ...dataStoreShape,
  API_PORT: integerFromString({ min: 1, max: 65535 }).default(3000),
  API_BASE_URL: httpUrl,
  /** ADR-04 pending. Pilot proposal: 256 KiB (SYSTEM_ARCHITECTURE.md §8). */
  PUBLISH_MAX_BODY_BYTES: integerFromString({ min: 1024, max: 10 * 1024 * 1024 }).default(262144),
  SECRET_ENCRYPTION_KEY: secretEncryptionKey,
});

export const dispatcherEnvSchema = z.object({
  ...commonShape,
  ...dataStoreShape,
  /** BE-08 owns the poll loop; phase 1 only validates the cadence. */
  DISPATCHER_POLL_INTERVAL_MS: integerFromString({ min: 100, max: 60_000 }).default(1000),
  DISPATCHER_PROBE_PORT: integerFromString({ min: 1, max: 65535 }).default(3001),
});

export const workerEnvSchema = z.object({
  ...commonShape,
  ...dataStoreShape,
  WORKER_CONCURRENCY: integerFromString({ min: 1, max: 100 }).default(5),
  WORKER_PROBE_PORT: integerFromString({ min: 1, max: 65535 }).default(3002),
  SECRET_ENCRYPTION_KEY: secretEncryptionKey,
  /** ADR-04 pending — all five are pilot proposals carried as configuration. */
  DELIVERY_TIMEOUT_MS: integerFromString({ min: 1000, max: 120_000 }).default(10000),
  DELIVERY_MAX_ATTEMPTS: integerFromString({ min: 1, max: 20 }).default(5),
  DELIVERY_BACKOFF_BASE_MS: integerFromString({ min: 100, max: 600_000 }).default(5000),
  DELIVERY_MAX_AGE_MS: integerFromString({ min: 60_000, max: 604_800_000 }).default(86400000),
  DELIVERY_MAX_RESPONSE_BYTES: integerFromString({ min: 1024, max: 1_048_576 }).default(65536),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type DispatcherEnv = z.infer<typeof dispatcherEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type EnvForRole<TRole extends ProcessRole> = TRole extends 'api'
  ? ApiEnv
  : TRole extends 'dispatcher'
    ? DispatcherEnv
    : WorkerEnv;

export const envSchemaByRole = {
  api: apiEnvSchema,
  dispatcher: dispatcherEnvSchema,
  worker: workerEnvSchema,
} as const;

/** Variables whose value must never be logged, printed or reported. */
export const SECRET_BEARING_VARIABLES = [
  'DATABASE_URL',
  'REDIS_URL',
  'SECRET_ENCRYPTION_KEY',
] as const;
