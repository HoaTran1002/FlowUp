import { Injectable, type NestMiddleware } from '@nestjs/common';
import { Logger, REQUEST_ID_RESPONSE_HEADER, resolveRequestId } from '@flowup/config';
import type { NextFunction, Request, Response } from 'express';

/**
 * Correlation-id middleware (BE-01 §3.2).
 *
 * Accepts a well-formed inbound request id, otherwise generates one; attaches
 * it to the request-scoped log context so every record emitted while handling
 * the request carries it; and echoes it on the response.
 *
 * The value attached here is the SAME value the error envelope returns
 * (`API_SPECIFICATION.md` §1), because both read it from the log context.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly logger: Logger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const { requestId } = resolveRequestId(request.headers);
    response.setHeader(REQUEST_ID_RESPONSE_HEADER, requestId);

    this.logger.runWithContext(
      {
        request_id: requestId,
        http_method: request.method,
        http_route: request.path,
      },
      () => {
        next();
      },
    );
  }
}
