# FlowUp Backend — Scoped Engineering Standard

**Document type:** Normative scoped standard · **Version:** 1.1
**Scope:** `apps/api/**`, and the shared backend modules used by `apps/dispatcher` and `apps/worker` when a backend task requires them.
**Precedence:** supplements the repository standard `AGENTS.md` and ranks above it for this directory; both rank below the approved product documents (`AGENTS.md` §1.3). Requirement keywords follow `AGENTS.md` §1.2. The invariants **INV-01**..**INV-12** in `AGENTS.md` §4 apply in full and are cited here by ID rather than restated.

---

## 1. Task Protocol

The task loop in `AGENT_ADAPTER.md` §4 MUST be followed. Backend tasks additionally MUST:

1. Open the task from its specification in `docs/phase-1/BE-XX.md`, and read the acceptance criteria before writing code.
2. Read the cited sections of `docs/URD.md`, `docs/PRD.md`, `docs/API_SPECIFICATION.md`, `docs/DATABASE_DESIGN.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/TECHNICAL_DESIGN.md` and `docs/TEST_PLAN.md`.
3. Inspect the existing implementation, migrations, tests and call sites before editing.
4. Record the requirement IDs (`FR-*`, `NFR-*`, `QA-*`, `INV-*`) in the report and PR description.
5. Implement the smallest change satisfying the task. An open ADR MUST NOT be silently resolved and an approved contract MUST NOT be silently changed.
6. Execute the relevant tests, typecheck and lint, review the diff, and report results honestly (INV-12).

For unresolved **ADR-01**..**ADR-05**, no security- or contract-sensitive assumption may be made without approval. Billing, AI, CRM, event transformation, Kafka, microservices and other out-of-scope features MUST NOT be added (`AGENTS.md` §2.3).

## 2. Technology and Module Boundaries

1. TypeScript, NestJS, Prisma, PostgreSQL, Redis and BullMQ; Bun for workspaces and package management. Runtime compatibility is governed by **ADR-06** (`AGENTS.md` §5.3).
2. The modular monolith MUST be maintained: controllers → application services → domain, persistence and infrastructure adapters.
3. `apps/api` (HTTP), `apps/dispatcher` (outbox enqueue) and `apps/worker` (delivery) MUST remain separately runnable processes sharing approved modules. An uncontrolled delivery loop MUST NOT run in the HTTP process.
4. Controllers MUST stay thin; business decisions MUST be testable in services. NestJS DI MUST be used. Cross-module circular imports, excessive abstraction and unrelated refactors MUST NOT be introduced.
5. PostgreSQL is authoritative for events, subscriptions resolved at acceptance, deliveries, attempts, retry schedule and audit history (INV-03).

## 3. API and Tenancy

1. `docs/API_SPECIFICATION.md` defines the `/v1` routes, response codes, error envelope, pagination, authorization and the outbound envelope and signature contract. A route, field, status or header MUST NOT be invented or silently modified.
2. Producer `POST /v1/events` uses a scoped Bearer machine key. Dashboard management uses an authenticated human session with authorization and CSRF protection once **ADR-01** is defined. These authentication modes are not interchangeable.
3. Tenant resolution and scoping follow INV-01. Tenant scope MUST be checked for every query, mutation, endpoint and nested resource.
4. API key creation and revocation and membership administration MUST be Admin-only. Developer permissions follow the API specification.
5. Body, types, content length, pagination, identifiers and event subscriptions MUST be validated at the server boundary. Explicit DTO validation is required; public contracts are shared only through `packages/contracts`.
6. The documented error envelope MUST be used, with a safe `code`, `message` and `request_id`. Raw payloads, signing secrets, API keys, downstream bodies and internal exception traces MUST NOT be leaked (INV-08).

## 4. Publish Transaction and Idempotency

1. Acceptance follows INV-02: `202` only after the event, delivery snapshots and outbox intents commit atomically.
2. The required `Idempotency-Key` MUST be unique in the database within its documented producer and key scope. The same key with the same canonical request returns the original accepted event; the same key with a changed request returns `409`.
3. Concurrency MUST be arbitrated by database uniqueness (INV-06); a race is resolved by reading the committed winner.
4. `application_id` MUST be validated as enabled, owned by the organization and permitted by the machine key. Only active subscribed endpoints of that application may match. Zero subscribers yields an accepted event with `delivery_count: 0` and no fabricated deliveries.
5. The destination URL, the endpoint signing-secret reference or version, and the relevant routing policy MUST be snapshotted at acceptance. A later endpoint edit MUST NOT rewrite accepted deliveries.
6. External HTTP calls and the Redis enqueue MUST remain outside the database transaction (INV-05).

## 5. Outbox, Queue, Retry and Worker

1. Dispatch follows the approved design: the outbox intent is persisted transactionally; the dispatcher claims due rows, then enqueues minimal jobs (`deliveryId`, `generation`, `attemptNumber`) and reconciles missed work.
2. Retry authority follows INV-04: the database owns the schedule and each job performs one attempt. A second queue-level retry loop MUST NOT be configured.
3. Deterministic job IDs MAY be used as an optimization only. Business deduplication MUST depend on database uniqueness, generation checks and conditional updates (INV-06).
4. A worker MUST acquire a conditional database lease before sending, and MUST reject stale generations, stale jobs and concurrent claims. A database transaction MUST NOT be held open during network I/O (INV-05).
5. Each attempt and its outcome MUST be persisted, and prior attempts MUST survive replay (INV-09). On lease expiry or crash, an unknown outcome MUST be classified as `UNKNOWN`; at-least-once delivery permits consumer duplicates (INV-10).
6. HTTP `2xx` confirms transport receipt, not consumer business completion. Retryable timeout, `429` and `5xx` and terminal errors MUST be classified per the PRD and technical design; blanket retry of all `4xx` is prohibited.
7. Request timeout, response size, attempt count, retry age and concurrency MUST be bounded as approved. Replay applies only to final `FAILED` deliveries and MUST be operation-idempotent, audit-logged and generation-aware.
8. A failing endpoint MUST NOT block other recipients. Queue loss or a Redis outage MUST NOT lose work already accepted in PostgreSQL (INV-02, INV-03).

## 6. Egress and Secret Handling

1. Endpoint URLs are untrusted input. Destination restrictions follow INV-07, enforced both at configuration time and immediately before every connection.
2. The actual DNS resolution and the connected IP MUST be validated — not only an earlier URL-string check — to prevent DNS rebinding and proxy bypass. Redirects MUST remain disabled unless a formally reviewed redirect policy is approved. TLS hostname verification MUST be preserved.
3. The exact outbound raw bytes and timestamp MUST be signed according to the versioned HMAC contract. The body MUST NOT be re-serialized between signature calculation and transmission.
4. Keys and secrets MUST be generated with a cryptographic RNG. Machine keys are stored hashed; signing secrets are stored encrypted and versioned. Credential exposure follows INV-08.
5. PII and sensitive fields MUST be redacted from logs, attempts, errors, traces and diagnostics. Rate limits and the retention policy from the approved decisions MUST be applied.
6. Tenant isolation, SSRF controls and signing MUST NOT be weakened to make a test pass (`AGENTS.md` §4).

## 7. Persistence and Migrations

1. Schema changes follow INV-11: a committed migration alongside the code, with indexes, foreign keys, unique constraints, transaction boundaries and the generated SQL inspected.
2. Queries MUST be organization-scoped with deterministic cursor ordering (`created_at`, `id`). N+1 queries and unbounded scans on event and delivery tables MUST be avoided.
3. Schema updates MUST preserve historical delivery and attempt correctness. Completed attempts and audit history MUST NOT be rewritten or deleted to simplify replay (INV-09).
4. The migration MUST be reconciled with `docs/DATABASE_DESIGN.md`, and any deviation MUST be flagged explicitly before a breaking change is applied.

## 8. Verification

Tests appropriate to the task MUST be added: unit, database integration, API contract, worker integration and failure recovery. The following cases are critical and MUST be covered where the change touches them:

1. The same and a different payload with a reused idempotency key; concurrent publishes.
2. No matching subscription; wrong organization or application scope.
3. Redis unavailable before and after event commit; dispatcher restart.
4. Worker crash after a consumer response but before the database finalize; stale jobs; lease expiry.
5. `2xx`, `429`, `5xx`, permanent `4xx`, timeout, retry exhaustion, replay race.
6. SSRF, DNS rebinding and redirect blocking; invalid HMAC verification; secret redaction.

The repository's existing scripts MUST be used; commands MUST NOT be invented, and a check MUST NOT be claimed as run when it was not (INV-12). A task is done only when the acceptance criteria pass, typecheck, lint and tests pass where runnable, and contracts and documents are updated where necessary. Unrun tests and unresolved risks MUST be stated.

## 9. Report

The report template in `AGENT_ADAPTER.md` §7 MUST be used, naming: the task and requirement IDs including `INV-*`; the behavior and files changed; the exact verification commands with real results; contract and migration impact; and remaining risks and open ADRs.
