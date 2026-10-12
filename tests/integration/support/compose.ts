import { Redis } from 'ioredis';
import { Client } from 'pg';

/**
 * Support for the integration layer (BE-01 §8).
 *
 * Integration tests target the Compose services and never mock PostgreSQL.
 * Each run gets a DEDICATED test database, dropped and recreated before the
 * migration runs, so a run is isolated from the development database and from
 * a previous run.
 *
 * When Compose is down the failure message says so explicitly, rather than
 * surfacing a bare connection error.
 */
const COMPOSE_HINT = 'Start it with: bun run compose:up';

function requireEnv(name: 'DATABASE_URL' | 'REDIS_URL'): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set. Integration tests need it. ${COMPOSE_HINT}`);
  }
  return value;
}

export function baseDatabaseUrl(): string {
  return requireEnv('DATABASE_URL');
}

export function redisUrl(): string {
  return requireEnv('REDIS_URL');
}

/** The dedicated per-run test database URL, derived from `DATABASE_URL`. */
export function testDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  const name = url.pathname.replace(/^\//, '');
  url.pathname = `/${name}_test`;
  return url.toString();
}

function databaseNameOf(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, '');
}

async function adminClient(): Promise<Client> {
  // Connect to the maintenance database so the test database can be dropped.
  const url = new URL(baseDatabaseUrl());
  url.pathname = '/postgres';
  url.search = '';

  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
  } catch (caught) {
    throw new Error(
      `PostgreSQL is not reachable at ${url.host}. ${COMPOSE_HINT} ` +
        `(underlying failure: ${caught instanceof Error ? caught.constructor.name : 'unknown'})`,
      { cause: caught },
    );
  }
  return client;
}

/** Drops and recreates the test database, giving every run a fresh schema. */
export async function recreateTestDatabase(): Promise<string> {
  const url = testDatabaseUrl();
  const name = databaseNameOf(url);
  const client = await adminClient();

  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }

  return url;
}

/**
 * Asserts Redis is reachable, with a bounded deadline and the same explicit
 * "Compose is down" message as the PostgreSQL path. Without it, a stopped
 * Redis surfaces as a slow pile of ioredis reconnect errors.
 */
export async function requireRedis(): Promise<void> {
  const url = redisUrl();
  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    commandTimeout: 1_000,
    retryStrategy: () => null,
  });
  client.on('error', () => undefined);

  try {
    // lazyConnect + no offline queue: the socket must exist before the first command.
    await client.connect();
    await client.ping();
  } catch (caught) {
    throw new Error(
      `Redis is not reachable at ${new URL(url).host}. ${COMPOSE_HINT} ` +
        `(underlying failure: ${caught instanceof Error ? caught.constructor.name : 'unknown'})`,
      { cause: caught },
    );
  } finally {
    client.disconnect();
  }
}

export interface MigrateResult {
  readonly exitCode: number;
  readonly stdout: string;
}

/**
 * Runs `db:migrate:deploy` against the test database — the same command CI and
 * Compose run, not a test-only code path.
 */
export async function migrateDeploy(databaseUrl: string): Promise<MigrateResult> {
  const child = Bun.spawn(['bun', 'run', 'db:migrate:deploy'], {
    cwd: new URL('../../../', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const exitCode = await child.exited;

  return { exitCode, stdout: `${stdout}${stderr}` };
}
