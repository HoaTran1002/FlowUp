import type { ProcessRole } from '@flowup/contracts';

import type { Logger } from '../logging/logger';

/**
 * Graceful shutdown for all three processes (TECHNICAL_DESIGN.md §10,
 * BE-01 §6.4).
 *
 * On `SIGTERM`/`SIGINT`: stop accepting new work, drain in-flight work within
 * a bounded deadline, close Prisma and Redis connections, exit zero.
 *
 * Phase 1 establishes the hook only. "Leave leases recoverable" is BE-10,
 * which has leases to leave.
 */

/** The bounded drain deadline. Shorter than a typical orchestrator SIGKILL. */
export const SHUTDOWN_DEADLINE_MS = 10_000;

export interface GracefulShutdownOptions {
  readonly role: ProcessRole;
  readonly logger: Logger;
  /** Stops accepting new work and closes resources. */
  readonly close: () => Promise<void>;
  readonly deadlineMs?: number;
}

export function installGracefulShutdown(options: GracefulShutdownOptions): void {
  const deadlineMs = options.deadlineMs ?? SHUTDOWN_DEADLINE_MS;
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    options.logger.info('shutdown signal received; draining', { signal });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        resolve('timeout');
      }, deadlineMs);
    });

    void Promise.race([options.close().then(() => 'closed' as const), deadline])
      .then((outcome) => {
        if (outcome === 'timeout') {
          options.logger.error('drain deadline exceeded; exiting non-zero', {
            duration_ms: deadlineMs,
          });
          process.exit(1);
        }
        options.logger.info('shutdown complete');
        process.exit(0);
      })
      .catch((caught: unknown) => {
        options.logger.errorCaught('shutdown failed', caught);
        process.exit(1);
      })
      .finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      shutdown(signal);
    });
  }
}
