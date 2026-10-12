import { createServer, type Server } from 'node:http';

import type { HealthResponse, ReadinessResponse } from '@flowup/contracts';

import type { Logger } from '../logging/logger';

/**
 * A minimal HTTP probe listener for the non-HTTP processes.
 *
 * `apps/dispatcher` and `apps/worker` are NestJS application contexts, not
 * HTTP servers (SYSTEM_ARCHITECTURE.md §3). BE-01 §6.2–§6.3 still require
 * them to expose health and readiness, so each runs this listener and nothing
 * else. It serves exactly two routes and never grows a third: it is an
 * operational probe, not an API surface.
 */
export interface ProbeServerOptions {
  readonly port: number;
  readonly logger: Logger;
  readonly health: () => HealthResponse;
  readonly readiness: () => Promise<ReadinessResponse>;
}

export interface ProbeServerHandle {
  readonly port: number;
  close: () => Promise<void>;
}

export async function startProbeServer(options: ProbeServerOptions): Promise<ProbeServerHandle> {
  const server: Server = createServer((request, response) => {
    const route = (request.url ?? '/').split('?')[0];

    const send = (status: number, body: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };

    if (request.method !== 'GET') {
      send(405, { status: 'method_not_allowed' });
      return;
    }

    if (route === '/health') {
      send(200, options.health());
      return;
    }

    if (route === '/ready') {
      void options
        .readiness()
        .then((body) => {
          send(body.status === 'ready' ? 200 : 503, body);
        })
        .catch((caught: unknown) => {
          options.logger.errorCaught('readiness probe failed', caught, { http_route: '/ready' });
          send(503, { status: 'not_ready' });
        });
      return;
    }

    send(404, { status: 'not_found' });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, () => {
      resolve();
    });
  });

  return {
    port: options.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
