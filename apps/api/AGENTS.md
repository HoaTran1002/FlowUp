# FlowUp API — Coding Agent Rules

Scope: `apps/api/**`, and shared backend modules used by `apps/worker` and `apps/dispatcher` when an API task requires them. This file supplements the repository-root `AGENTS.md`; product and approved design documents remain authoritative.

## 1. Task protocol (mandatory)

1. Identify the requested `BE-XX` task and its acceptance criteria in `docs/IMPLEMENTATION_PLAN.md`.
2. Read the relevant sections of `docs/URD.md`, `docs/PRD.md`, `docs/API_SPECIFICATION.md`, `docs/DATABASE_DESIGN.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/TECHNICAL_DESIGN.md`, and `docs/TEST_PLAN.md`. Use the actual document location if the repository layout differs.
3. Inspect existing implementation, migrations, tests, and call sites before editing.
4. Note requirement IDs (`FR-*`, `NFR-*`, `QA-*`) in the plan/PR description.
5. Implement the smallest change that satisfies the task. Do not silently resolve an open ADR or change an approved contract.
6. Execute relevant tests/typecheck/lint, inspect the diff, and report results honestly.

If documentation conflicts, report the exact conflict and propose a resolution. For unresolved ADR-01..05, make no security- or contract-sensitive assumption without approval. Do not add billing, AI, CRM, event transformation, Kafka, microservices, or unrelated features.

## 2. Technology and boundaries

- TypeScript, NestJS, Prisma, PostgreSQL, Redis and BullMQ; Bun for workspaces/package management.
- Runtime compatibility of Bun with the chosen NestJS/Prisma/BullMQ versions must be proven; a supported Node.js LTS process is an allowed fallback per technical design.
- Maintain a modular monolith: controllers -> application services -> domain/persistence/infrastructure adapters.
- Keep HTTP API (`apps/api`), outbox dispatcher (`apps/dispatcher`), and delivery worker (`apps/worker`) separately runnable processes sharing approved modules; never run an uncontrolled delivery loop in the HTTP process.
- Keep controllers thin and business decisions testable in services; use NestJS DI. Avoid cross-module circular imports, excessive abstractions, and unrelated refactors.
- PostgreSQL is authoritative for events, subscriptions resolved at acceptance, deliveries, attempts, retry schedule and audit history. Redis/BullMQ is execution infrastructure, never the only durable record.

## 3. API and tenancy invariants

- `docs/API_SPECIFICATION.md` defines `/v1` routes, response codes, error envelope, pagination, authorization and outbound envelope/signature contract. Never invent or silently modify routes, fields, statuses or headers.
- Producer `POST /v1/events` uses a scoped Bearer machine key. Dashboard management uses authenticated human sessions, authorization and CSRF protection once ADR-01 is defined. These authentication modes are not interchangeable.
- Resolve `organizationId` from the authenticated principal, NEVER from caller-provided body/query parameters. Check tenant scope for every query, mutation, endpoint and nested resource; non-owned IDs must not leak cross-tenant information.
- Enforce Admin-only API key creation/revocation and membership administration. Developer permissions follow the API specification.
- Validate body, types, content length, pagination, identifiers and event subscriptions at the server boundary. Prefer explicit DTO/validation; share public contracts only through approved `packages/contracts`.
- Use the documented API error envelope with safe `code`, `message`, and `request_id`. Do not leak raw payloads, signing secrets, API keys, downstream bodies or internal exception traces.

## 4. Publish transaction and idempotency

- Only return HTTP `202` after PostgreSQL successfully commits the accepted event, delivery snapshots, and outbox intents atomically. Redis availability must not decide whether a committed event is accepted.
- Enforce required `Idempotency-Key` uniqueness in database within its documented producer/key scope. Same key + same canonical request returns the original accepted event; same key + changed request returns `409`.
- Rely on database uniqueness for concurrent requests; handle races by reading the committed winner. Do not use in-process maps for correctness.
- Validate `application_id` is enabled, owned by the organization and permitted by the machine key. Match only active subscribed endpoints of that application. Zero subscribers => accepted event with `delivery_count: 0`, no fabricated deliveries.
- Snapshot destination URL, endpoint/signing-secret reference or version and relevant routing policy at acceptance. Later endpoint edits must not silently rewrite accepted deliveries.
- Keep external HTTP calls and Redis enqueue outside database transactions.

## 5. BullMQ, outbox, retry and worker rules

- Follow the Phase 2 design: transactionally persist outbox intent; dispatcher claims due rows, then enqueues minimal jobs (`deliveryId`, `generation`, `attemptNumber`) and reconciles missed work.
- **Database owns retry schedule and attempts.** For v0.1, each BullMQ job performs one attempt (`attempts: 1`). Never configure a second independent BullMQ exponential retry loop on top of persisted retry/outbox scheduling.
- Use deterministic job IDs only as an optimization. Business deduplication must depend on DB uniqueness, generation checks and conditional updates, not Redis job retention.
- Workers must acquire a conditional DB lease before sending. Reject stale generation/jobs and concurrent claims. Never hold a DB transaction open during network I/O.
- Persist each attempt and its outcome; preserve prior attempts across replay. On lease expiry/crash, classify unknown outcomes carefully: at-least-once delivery permits consumer duplicates.
- HTTP `2xx` confirms transport receipt, not consumer business completion. Classify retryable timeout/429/5xx and terminal errors per PRD/technical design; do not blanket-retry all 4xx.
- Use bounded request timeout, response size, attempts, retry age and concurrency as approved. Replay applies only to final `FAILED` deliveries and must be operation-idempotent, audit logged, and generation-aware.
- An endpoint failing must not block other recipients. Queue loss or Redis outage must not lose PostgreSQL-accepted work.

## 6. HTTP egress and secrets security

- Treat endpoint URLs as untrusted. Enforce HTTPS/public destinations; reject loopback, private, link-local, metadata and disallowed IP ranges for IPv4 and IPv6.
- Validate the actual DNS resolution and connected IP (not just an earlier URL string check); prevent DNS rebinding and proxy bypass. Disable redirects unless a formally reviewed redirect policy is approved. Preserve TLS hostname verification.
- Sign the exact outbound raw bytes and timestamp according to the versioned HMAC contract. Do not serialize again between signature calculation and HTTP send.
- Generate high-entropy keys/secrets; store machine keys as hashes and signing secrets encrypted/versioned according to design. Raw values are shown only when created or rotated; never log, cache or expose again.
- Redact PII and sensitive fields in logs, attempts, errors, traces and diagnostics. Apply rate limits and retention policy from approved decisions.
- Never weaken tenant isolation, SSRF controls or signing to make a test pass.

## 7. Database/migration discipline

- Prisma schema changes require migrations committed alongside code. Inspect indexes, foreign keys, unique constraints, transaction boundaries and actual generated SQL.
- Use organization-scoped queries and deterministic ordering for cursors (`created_at`, `id`); avoid N+1 queries and unbounded scans on event/delivery tables.
- Schema updates must preserve historical delivery/attempt correctness. Do not rewrite completed attempts or delete audit history to simplify replay.
- Reconcile `docs/DATABASE_DESIGN.md` with the migration; flag deviations explicitly before applying breaking changes.

## 8. Testing and Definition of Done

Add tests appropriate to the task: unit, database integration, API contract, worker integration, and failure recovery. Critical cases include:
- same/different payload with reused idempotency key, concurrent publishes;
- no matching subscription, wrong organization or application scope;
- Redis unavailable before/after event commit; dispatcher restart;
- worker crash after consumer response but before DB finalize, stale jobs, lease expiry;
- 2xx, 429, 5xx, permanent 4xx, timeout, retry exhaustion, replay race;
- SSRF/DNS rebinding/redirect block, invalid HMAC verification and secret redaction.

Run the repo's existing scripts; do not invent commands or claim checks ran when they did not. A task is done only when requirements and acceptance criteria pass, typecheck/lint/tests pass where runnable, and contracts/docs are updated when necessary. State any unrun tests and unresolved risks.

## 9. Final agent report

Use this concise format:

- Task/requirements: `BE-XX`, `FR-*`, `QA-*`.
- Changes: behavior and files touched.
- Verification: exact commands and pass/fail results.
- Contracts/migrations: changed or unchanged.
- Risks/blockers: remaining work and open ADRs.
