import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { RedisService, createRedisConnection } from '@flowup/config';
import { Queue, Worker } from 'bullmq';

import { redisUrl, requireRedis } from './support/compose';

/**
 * Queue integration (BE-01 §5, §8): connectivity ONLY.
 *
 * This is a connectivity smoke test, deliberately kept rather than left as a
 * half-built delivery queue. There is no delivery queue name, no processor and
 * no retry configuration here — those are BE-08 and BE-09.
 */
const QUEUE_NAME = 'flowup.connectivity-smoke';

beforeAll(async () => {
  await requireRedis();
}, 15_000);

const connections: { quit: () => Promise<unknown> }[] = [];

function track<TConnection extends { quit: () => Promise<unknown> }>(
  connection: TConnection,
): TConnection {
  connections.push(connection);
  return connection;
}

afterAll(async () => {
  await Promise.all(connections.map((connection) => connection.quit().catch(() => undefined)));
});

describe('Redis connectivity', () => {
  it('answers a readiness ping', async () => {
    const service = new RedisService(redisUrl());
    const reply = await service.ping().then(
      () => 'up' as const,
      () => 'down' as const,
    );
    await service.onModuleDestroy();
    expect(reply).toBe('up');
  });

  it('fails the readiness ping fast when Redis is unreachable', async () => {
    // The readiness connection must not retry forever: a stopped Redis has to
    // surface as `down`, not as a hanging probe (BE-01 §7).
    const unreachable = new RedisService('redis://127.0.0.1:6399');
    const startedAt = Date.now();
    const reply = await unreachable.ping().then(
      () => 'up' as const,
      () => 'down' as const,
    );
    const elapsed = Date.now() - startedAt;
    await unreachable.onModuleDestroy();

    expect(reply).toBe('down');
    expect(elapsed).toBeLessThan(3_000);
  }, 15_000);

  it('is configured with maxmemory-policy noeviction', async () => {
    // Non-negotiable (SYSTEM_ARCHITECTURE.md §3): eviction would silently drop
    // coordination state. Asserted against the real server, not the compose file.
    const client = track(createRedisConnection(redisUrl()));
    const policy = await client.config('GET', 'maxmemory-policy');
    expect(policy).toEqual(['maxmemory-policy', 'noeviction']);
  });
});

describe('BullMQ', () => {
  it('enqueues and consumes one trivial job with attempts: 1', async () => {
    const queue = new Queue(QUEUE_NAME, { connection: track(createRedisConnection(redisUrl())) });
    await queue.obliterate({ force: true });

    let worker: Worker<{ ping: string }> | undefined;
    const consumed = new Promise<{ ping: string; attempts: number }>((resolve, reject) => {
      worker = new Worker<{ ping: string }>(
        QUEUE_NAME,
        (job): Promise<void> => {
          resolve({ ping: job.data.ping, attempts: job.opts.attempts ?? 0 });
          return Promise.resolve();
        },
        { connection: track(createRedisConnection(redisUrl())), concurrency: 1 },
      );
      worker.on('error', reject);
      setTimeout(() => {
        reject(new Error('job was not consumed within 15s'));
      }, 15_000);
    });

    // INV-04: the database owns the retry schedule, so a job performs exactly
    // one attempt. A second, queue-level retry loop must not exist.
    await queue.add('smoke', { ping: 'pong' }, { attempts: 1 });

    expect(await consumed).toEqual({ ping: 'pong', attempts: 1 });

    await worker?.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }, 30_000);
});
