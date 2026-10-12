import { z } from 'zod';

/**
 * Liveness and readiness response contracts.
 *
 * These routes live OUTSIDE `/v1` and are deliberately not part of the public
 * API contract (BE-01 §6.1): `API_SPECIFICATION.md` does not define them. They
 * are shared here because all three backend processes and the Compose
 * healthchecks must agree on one shape.
 */
export const PROCESS_ROLES = ['api', 'dispatcher', 'worker'] as const;
export const READINESS_CHECKS = ['database', 'redis', 'migrations'] as const;

export const processRoleSchema = z.enum(PROCESS_ROLES);
export const readinessCheckStatusSchema = z.enum(['up', 'down']);

/** Liveness: the process is running. It makes no dependency call. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  process: processRoleSchema,
  uptime_seconds: z.number().nonnegative(),
});

/** Readiness: the process can do its job right now. */
export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  process: processRoleSchema,
  checks: z.object({
    database: readinessCheckStatusSchema,
    redis: readinessCheckStatusSchema,
    migrations: readinessCheckStatusSchema,
  }),
});

export type ProcessRole = z.infer<typeof processRoleSchema>;
export type ReadinessCheck = (typeof READINESS_CHECKS)[number];
export type ReadinessCheckStatus = z.infer<typeof readinessCheckStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
