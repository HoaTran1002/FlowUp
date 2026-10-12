import type { ProcessRole } from '@flowup/contracts';

import { envSchemaByRole, type EnvForRole } from './schema';

/**
 * Fail-fast configuration loading (TECHNICAL_DESIGN.md §10).
 *
 * The environment is parsed exactly once, at bootstrap. On failure the process
 * reports the NAMES of the invalid variables and exits non-zero. No value is
 * ever included in the message, because a failing variable may be
 * secret-bearing (INV-08).
 */

export interface EnvFailure {
  readonly variables: string[];
  readonly issues: { variable: string; message: string }[];
}

export type EnvResult<TRole extends ProcessRole> =
  | { readonly ok: true; readonly config: Readonly<EnvForRole<TRole>> }
  | { readonly ok: false; readonly failure: EnvFailure };

/**
 * Parses the environment for a role. Pure and total: it never exits and never
 * throws, so the failure path is unit-testable.
 */
export function parseEnv<TRole extends ProcessRole>(
  role: TRole,
  source: Record<string, string | undefined> = process.env,
): EnvResult<TRole> {
  const result = envSchemaByRole[role].safeParse(source);

  if (result.success) {
    return { ok: true, config: Object.freeze(result.data) as Readonly<EnvForRole<TRole>> };
  }

  const issues = result.error.issues.map((issue) => ({
    variable: issue.path.map(String).join('.') || '(unknown)',
    // The message is schema-derived. It describes the expected shape and never
    // quotes the received value.
    message: issue.message,
  }));

  return {
    ok: false,
    failure: {
      variables: [...new Set(issues.map((issue) => issue.variable))].sort(),
      issues,
    },
  };
}

/**
 * Parses the environment or terminates the process.
 *
 * Writes a single structured line to stderr. `console.*` is banned in
 * application code, and the logger itself needs valid configuration, so this
 * writes to the stream directly.
 */
export function loadEnvOrExit<TRole extends ProcessRole>(role: TRole): Readonly<EnvForRole<TRole>> {
  const result = parseEnv(role);
  if (result.ok) return result.config;

  process.stderr.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      level: 'error',
      process: role,
      msg: 'invalid configuration; refusing to start',
      invalid_variables: result.failure.variables,
      issues: result.failure.issues,
    })}\n`,
  );
  process.exit(1);
}
