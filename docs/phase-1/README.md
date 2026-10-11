# FlowUp — Phase 1: Workspace Setup

**Scope:** stand up the monorepo, infrastructure and runnable skeletons for the backend (`BE-01`) and frontend (`FE-01`) described in `docs/IMPLEMENTATION_PLAN.md` §3–§4.

**Status:** Derived procedure. The approved documents (`PRODUCT_OVERVIEW.md`, `URD.md`, `PRD.md`, `SYSTEM_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_SPECIFICATION.md`, `TECHNICAL_DESIGN.md`, `UI_UX_SPECIFICATION.md`, `IMPLEMENTATION_PLAN.md`, `TEST_PLAN.md`) remain authoritative. If this document contradicts them, they win and this document must be corrected.

**Audience:** any coding agent or engineer. Read `AGENT_ADAPTER.md` first.

## 1. Documents in this phase

| Document | Task | Covers |
|---|---|---|
| This file | — | shared workspace root, environment contract, ADR-06 runtime gate, phase exit criteria |
| [`BACKEND_SETUP.md`](BACKEND_SETUP.md) | `BE-01` | `apps/api`, `apps/dispatcher`, `apps/worker`, Prisma, Docker Compose (PostgreSQL + Redis), logging/request IDs, CI |
| [`FRONTEND_SETUP.md`](FRONTEND_SETUP.md) | `FE-01` | `apps/web`: Vite, TanStack Router/Query, Axios client, shadcn/ui shell, error boundary, mock-driven tests |

Read the shared sections here (§2–§6) before either setup document. The two setup documents are independent after that and may be executed in parallel by different agents.

## 2. What phase 1 must NOT do

Setup is deliberately thin. Do not implement, scaffold a schema for, or stub in a way that implies:

- Authentication, sessions, invitations or CSRF — blocked by **ADR-01**. No login implementation, no token storage, no session middleware beyond a placeholder that rejects all requests.
- Business endpoints from `docs/API_SPECIFICATION.md` §2. Phase 1 adds **health and readiness only**.
- The business schema from `docs/DATABASE_DESIGN.md` §3. That is `BE-03`. Phase 1 proves migrations run; it does not define business tables.
- Delivery, signing, SSRF validation, retry or replay logic. Those are `BE-06`..`BE-12`.
- Any feature outside the MVP boundary (CRM, marketing, workflow builder, transformation, billing, AI, connectors, SSO).

Phase 1 output is a repository that boots, typechecks, lints, tests, migrates, and serves a health check for every process — nothing more.

## 3. Target repository layout

Per `docs/TECHNICAL_DESIGN.md` §1:

```text
flowup/
  apps/
    api/               # NestJS HTTP app
    dispatcher/        # NestJS application context: outbox enqueue + reconciliation
    worker/            # NestJS application context: delivery processor
    web/               # React application
  packages/
    contracts/         # Zod types + OpenAPI-derived client types
    config/            # env schema, shared telemetry config
  prisma/              # single centralized Prisma schema + migrations
  infrastructure/
    docker-compose.yml
    migrations/        # optional raw SQL for partial indexes/locking
  docs/
  package.json  bun.lock  tsconfig.base.json
```

Normative notes:

- Prisma migrations are centralized in **one** location, never generated per executable (`TECHNICAL_DESIGN.md` §2).
- `apps/api`, `apps/dispatcher` and `apps/worker` are separately runnable processes sharing approved modules (`SYSTEM_ARCHITECTURE.md` §3). The HTTP process must never run an uncontrolled delivery loop.
- `packages/contracts` is the only place public contract types are shared between backend and frontend. The frontend must not hand-copy backend DTOs.

## 4. Workspace root setup

### 4.1 Root `package.json`

Bun workspaces (`TECHNICAL_DESIGN.md` §1), with `apps/*` and `packages/*` as members. Required root scripts, used verbatim by CI and by every later task's report:

| Script | Purpose |
|---|---|
| `typecheck` | TypeScript project-wide, no emit |
| `lint` | ESLint across workspaces |
| `format:check` | Prettier check |
| `test` | unit tests across workspaces |
| `test:integration` | DB/queue integration tests (requires Compose) |
| `db:migrate` | apply Prisma migrations (dev) |
| `db:migrate:deploy` | apply Prisma migrations (CI/prod) |
| `db:generate` | generate Prisma client |
| `dev:api`, `dev:dispatcher`, `dev:worker`, `dev:web` | run a single process |
| `compose:up`, `compose:down` | infrastructure lifecycle |

Do not invent additional script names in later tasks; extend this list and record the change.

### 4.2 Shared TypeScript configuration

One `tsconfig.base.json` at the root with `strict: true`, each workspace extending it. Strictness is not optional: later tasks depend on generated contract types compiling (`BE-14`).

### 4.3 Tooling baseline

- ESLint + Prettier, with the same rules for backend and frontend where the ecosystem allows.
- `.editorconfig`, `.gitignore` (must ignore `.env`, `node_modules`, build output, Prisma generated client).
- `.env.example` committed; **`.env` never committed** (`TECHNICAL_DESIGN.md` §10: secrets outside the repository).

## 5. Environment contract

Validate environment with a fail-fast schema in `packages/config` (`TECHNICAL_DESIGN.md` §10). A process must refuse to start on invalid configuration rather than degrade.

| Variable | Used by | Notes |
|---|---|---|
| `NODE_ENV` | all | `development` \| `test` \| `production` |
| `LOG_LEVEL` | all | structured logging level |
| `DATABASE_URL` | api, dispatcher, worker | PostgreSQL connection string |
| `DATABASE_POOL_SIZE` | api, dispatcher, worker | pool sizing is per-process (`TECHNICAL_DESIGN.md` §10) |
| `REDIS_URL` | api, dispatcher, worker | BullMQ connection |
| `API_PORT` | api | HTTP port |
| `API_BASE_URL` | web, tooling | public API origin |
| `SECRET_ENCRYPTION_KEY` | api, worker | master key for endpoint signing secrets; **placeholder in phase 1, validated as present and of correct length, never used yet** |
| `WORKER_CONCURRENCY` | worker | bounded concurrency (`TECHNICAL_DESIGN.md` §10) |
| `DISPATCHER_POLL_INTERVAL_MS` | dispatcher | outbox poll cadence |
| `VITE_API_BASE_URL` | web | build-time API origin |

Phase-1 rules for secrets: generate local development values with a cryptographic RNG, keep them in the untracked `.env`, and never print them in logs, test output, CI logs or an agent report.

## 6. ADR-06 runtime gate (must be resolved in this phase)

`IMPLEMENTATION_PLAN.md` §8 lists **ADR-06 — Bun/NestJS/Prisma/BullMQ runtime compatibility matrix** as a milestone-0 blocker, and `TECHNICAL_DESIGN.md` §1 requires the runtime choice to be *verified* with the exact dependency versions.

Procedure:

1. Pin exact versions of Bun, NestJS, `@prisma/client`/`prisma`, and BullMQ in the lockfile.
2. Run, under the Bun runtime: NestJS bootstrap, a Prisma query against Compose PostgreSQL, a BullMQ enqueue plus consume against Compose Redis, and the test runner.
3. Record the result as a compatibility table in this phase's output (versions, pass/fail per item, date).
4. **Decision:** if all pass, Bun is both package manager and runtime. If any fails, keep Bun as package manager and run the NestJS processes on a supported Node.js LTS, without changing the product architecture (`TECHNICAL_DESIGN.md` §1, `apps/api/AGENTS.md` §2).

Do not skip this gate or assume the outcome. State the decision and its evidence in the `BE-01` report.

## 7. Phase exit criteria

Phase 1 is complete only when all of the following are true and were actually executed:

| # | Criterion | Evidence |
|---|---|---|
| 1 | `compose:up` brings up PostgreSQL and Redis; Redis uses `maxmemory-policy noeviction` | container status + `CONFIG GET maxmemory-policy` |
| 2 | `db:migrate` applies the baseline migration against Compose PostgreSQL | migration output |
| 3 | `api`, `dispatcher`, `worker` each start and answer health and readiness checks | request/response per process |
| 4 | `web` dev server serves the authenticated shell routes against mocked API data | route list + screenshot or test output |
| 5 | `typecheck`, `lint`, `test` pass at the workspace root | command output |
| 6 | CI runs install, typecheck, lint, test, and migrations on a clean checkout | CI run link/output |
| 7 | ADR-06 decision recorded with the version matrix | §6 table |
| 8 | No secret value appears in logs, test output, CI output or committed files | reviewed diff + log scan |
| 9 | No business endpoint, business table, auth scheme or delivery logic was introduced | reviewed diff |

Gate to the next milestone (`IMPLEMENTATION_PLAN.md` §2, M0): the security-sensitive open questions — above all **ADR-01** (dashboard auth/session/invitation/CSRF) — must be resolved before `BE-02` or `FE-02` begins. Setup completing does not open that gate.

## 8. Report

Report `BE-01` and `FE-01` separately, each in the format in `AGENT_ADAPTER.md` §7, including the ADR-06 matrix for `BE-01` and the mock-data strategy for `FE-01`. Label every check you could not execute as `NOT RUN` with the reason.
