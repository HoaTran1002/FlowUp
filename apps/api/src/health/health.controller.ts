import { Controller, Get, Res } from '@nestjs/common';
import { ReadinessService } from '@flowup/config';
import type { HealthResponse, ReadinessResponse } from '@flowup/contracts';
import type { Response } from 'express';

/**
 * Liveness and readiness.
 *
 * These routes are deliberately OUTSIDE `/v1` (BE-01 §6.1): they are an
 * operational contract, not part of the public API. The global prefix in
 * `main.ts` excludes them explicitly.
 */
@Controller()
export class HealthController {
  constructor(private readonly readinessService: ReadinessService) {}

  /** Liveness: the process is up. Makes no dependency call. */
  @Get('health')
  health(): HealthResponse {
    return this.readinessService.health();
  }

  /**
   * Readiness: PostgreSQL reachable, Redis reachable, migrations applied.
   * Returns `503` when any check is down so that an orchestrator stops
   * routing traffic without the process being restarted.
   */
  @Get('ready')
  async ready(@Res() response: Response<ReadinessResponse>): Promise<void> {
    const body = await this.readinessService.readiness();
    response.status(body.status === 'ready' ? 200 : 503).json(body);
  }
}
