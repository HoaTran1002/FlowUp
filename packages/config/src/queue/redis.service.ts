import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';

/**
 * The shared Redis / BullMQ connection factory (BE-01 §5).
 *
 * Two settled constraints are recorded here so that later tasks do not
 * re-litigate them:
 *
 *  1. Redis is EXECUTION COORDINATION ONLY and is never the authoritative
 *     record of anything. PostgreSQL is the source of truth for events,
 *     deliveries, attempts, the retry schedule and audit history
 *     (SYSTEM_ARCHITECTURE.md §3, INV-03). A Redis outage must not lose work
 *     already accepted in PostgreSQL.
 *  2. v0.1 enqueues every job with `attempts: 1`. The DATABASE owns the retry
 *     schedule; a second, queue-level retry loop must not exist
 *     (TECHNICAL_DESIGN.md §4, apps/api/AGENTS.md §5, INV-04).
 *
 * Phase 1 proves connectivity only. There are no queue names, no processors
 * and no retry configuration here — those are BE-08 and BE-09.
 */

/**
 * Options BullMQ requires of its connections. `maxRetriesPerRequest: null` is
 * mandatory for BullMQ blocking commands.
 */
export const BULLMQ_CONNECTION_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

/**
 * Options for the readiness connection.
 *
 * Deliberately NOT the BullMQ options: `maxRetriesPerRequest: null` retries a
 * command forever, so a readiness ping against a stopped Redis would hang
 * instead of reporting `down`. Readiness must fail fast and degrade
 * (BE-01 §7). `enableOfflineQueue: false` makes a command rejected
 * immediately while the socket is down, and the retry strategy still allows
 * the connection to recover once Redis returns.
 */
export const HEALTH_CONNECTION_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  enableReadyCheck: false,
  connectTimeout: 1_000,
  commandTimeout: 1_000,
  lazyConnect: true,
  retryStrategy: (attempt: number) => Math.min(attempt * 200, 2_000),
};

export function createRedisConnection(url: string, options: RedisOptions = {}): Redis {
  return new Redis(url, { ...BULLMQ_CONNECTION_OPTIONS, ...options });
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly url: string) {
    this.client = new Redis(url, HEALTH_CONNECTION_OPTIONS);
    // A readiness client must never take the process down on a connection error.
    this.client.on('error', () => undefined);
  }

  /** A connection suitable for handing to a BullMQ `Queue` or `Worker`. */
  createConnection(options: RedisOptions = {}): Redis {
    return createRedisConnection(this.url, options);
  }

  async ping(): Promise<void> {
    // The readiness client is lazy and has no offline queue (so a stopped
    // Redis fails fast). That means the socket must be opened explicitly: a
    // command issued while status is `wait` would be rejected even though
    // Redis is healthy, producing a false `down` on the first probe.
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
    }
    const reply = await this.client.ping();
    if (reply !== 'PONG') {
      throw new Error('unexpected Redis PING reply');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
    await Promise.resolve();
  }
}
