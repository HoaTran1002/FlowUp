import { AsyncLocalStorage } from 'node:async_hooks';

import type { ProcessRole } from '@flowup/contracts';

import { LOG_LEVEL_SEVERITY, type LogFields, type LogLevel } from './fields';
import { errorCategory, sanitizeFields } from './redaction';

/**
 * The structured logger shared by all three processes (BE-01 §3.2, D9).
 *
 * Properties:
 *  - JSON output outside development, so logs are machine-readable in Compose,
 *    CI and production. Development keeps JSON too, on one line, so that what
 *    an engineer reads is what an operator reads.
 *  - Only allowlisted, primitive, non-sensitive fields are serialized
 *    (see `redaction.ts`). There is no code path that serializes a header, a
 *    body or an arbitrary object (INV-08).
 *  - Request-scoped context flows through `AsyncLocalStorage`, so a handler
 *    deep in a call stack logs the right `request_id` without threading it.
 */

export interface LogRecord extends LogFields {
  readonly time: string;
  readonly level: LogLevel;
  readonly process: ProcessRole;
  readonly msg: string;
}

export interface LoggerOptions {
  readonly role: ProcessRole;
  readonly level: LogLevel;
  readonly pretty?: boolean;
  /** Injectable sink. Defaults to stdout. */
  readonly write?: (line: string) => void;
}

const contextStorage = new AsyncLocalStorage<LogFields>();

export class Logger {
  private readonly role: ProcessRole;
  private readonly severity: number;
  private readonly bound: LogFields;
  private readonly write: (line: string) => void;

  constructor(options: LoggerOptions, bound: LogFields = {}) {
    this.role = options.role;
    this.severity = LOG_LEVEL_SEVERITY[options.level];
    this.bound = bound;
    this.write =
      options.write ??
      ((line: string) => {
        process.stdout.write(`${line}\n`);
      });
  }

  /** Returns a logger with additional permanently bound fields. */
  child(fields: Record<string, unknown>): Logger {
    return new Logger(
      { role: this.role, level: this.levelName(), write: this.write },
      { ...this.bound, ...sanitizeFields(fields) },
    );
  }

  /**
   * Runs `fn` with request-scoped log fields attached. Everything logged
   * inside — at any depth — carries them.
   */
  runWithContext<TResult>(fields: Record<string, unknown>, fn: () => TResult): TResult {
    const merged = { ...contextStorage.getStore(), ...sanitizeFields(fields) };
    return contextStorage.run(merged, fn);
  }

  /** The current request-scoped fields, if any. */
  static context(): LogFields {
    return contextStorage.getStore() ?? {};
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.emit('debug', msg, fields);
  }

  info(msg: string, fields?: Record<string, unknown>): void {
    this.emit('info', msg, fields);
  }

  warn(msg: string, fields?: Record<string, unknown>): void {
    this.emit('warn', msg, fields);
  }

  error(msg: string, fields?: Record<string, unknown>): void {
    this.emit('error', msg, fields);
  }

  /**
   * Logs a thrown value as a sanitized category. The error message is NOT
   * logged: it can carry a URL, a payload fragment or a credential
   * (SYSTEM_ARCHITECTURE.md §7).
   */
  errorCaught(msg: string, caught: unknown, fields?: Record<string, unknown>): void {
    this.emit('error', msg, { ...fields, error_category: errorCategory(caught) });
  }

  /** Builds the record without writing it. Used by the redaction tests. */
  buildRecord(level: LogLevel, msg: string, fields?: Record<string, unknown>): LogRecord {
    return {
      time: new Date().toISOString(),
      level,
      process: this.role,
      msg,
      ...this.bound,
      ...Logger.context(),
      ...sanitizeFields(fields),
    };
  }

  private emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LOG_LEVEL_SEVERITY[level] < this.severity) return;
    this.write(JSON.stringify(this.buildRecord(level, msg, fields)));
  }

  private levelName(): LogLevel {
    const found = (Object.keys(LOG_LEVEL_SEVERITY) as LogLevel[]).find(
      (level) => LOG_LEVEL_SEVERITY[level] === this.severity,
    );
    return found ?? 'info';
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
