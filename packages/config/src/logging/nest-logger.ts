import type { LoggerService } from '@nestjs/common';

import type { Logger } from './logger';

/**
 * Bridges NestJS framework logging into the structured logger.
 *
 * Nest is given this adapter rather than `logger: false`. Silencing Nest also
 * silences its FATAL diagnostics — a missing optional peer dependency makes
 * `loadPackage` call `process.exit(1)` after logging, which with no logger is
 * an exit with no explanation. Framework diagnostics are operational text
 * produced by Nest itself, never request content, and they travel through the
 * same JSON sink and the same allowlisted field set as everything else.
 */
export class NestLoggerBridge implements LoggerService {
  constructor(private readonly logger: Logger) {}

  private static text(message: unknown): string {
    return typeof message === 'string' ? message : JSON.stringify(message);
  }

  log(message: unknown): void {
    this.logger.info(`nest: ${NestLoggerBridge.text(message)}`);
  }

  error(message: unknown): void {
    this.logger.error(`nest: ${NestLoggerBridge.text(message)}`);
  }

  warn(message: unknown): void {
    this.logger.warn(`nest: ${NestLoggerBridge.text(message)}`);
  }

  debug(message: unknown): void {
    this.logger.debug(`nest: ${NestLoggerBridge.text(message)}`);
  }

  verbose(message: unknown): void {
    this.logger.debug(`nest: ${NestLoggerBridge.text(message)}`);
  }

  fatal(message: unknown): void {
    this.logger.error(`nest: ${NestLoggerBridge.text(message)}`);
  }
}
