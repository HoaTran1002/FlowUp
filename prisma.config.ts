import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (Prisma 7).
 *
 * Prisma 7 removed `datasource.url` from the schema, so the CLI connection
 * string is resolved here. It also no longer auto-loads `.env`, and the CLI is
 * a Node process that does not inherit Bun's `.env` injection, so this file
 * loads `.env` itself without adding a dependency.
 *
 * This file is the only place outside `packages/config` that reads an
 * environment variable directly: it is CLI configuration evaluated before any
 * NestJS process exists, so it cannot go through the DI-provided config object
 * (AGENTS.md §6.2). Already-set variables always win, so CI and Compose stay
 * authoritative. The value is never logged.
 */
function loadDotEnv(file: string): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    if (key in process.env) continue;

    const value = line.slice(separator + 1).trim();
    process.env[key] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadDotEnv('.env');

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is not set. The Prisma CLI cannot run without it.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
