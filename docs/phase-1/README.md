# FlowUp — Build Phase 1: v0.1 Pilot

**Scope:** every implementation task required to reach the v0.1 pilot — `BE-01`..`BE-14` and `FE-01`..`FE-10` from `docs/IMPLEMENTATION_PLAN.md` §3–§4.

**Goal (`IMPLEMENTATION_PLAN.md`):** one pilot organization can onboard, configure two endpoints, publish one event, inspect independent outcomes and replay a final failed delivery securely.

**Status:** Derived specifications. The approved documents remain authoritative (`PRODUCT_OVERVIEW.md`, `URD.md`, `PRD.md`, `SYSTEM_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_SPECIFICATION.md`, `TECHNICAL_DESIGN.md`, `UI_UX_SPECIFICATION.md`, `IMPLEMENTATION_PLAN.md`, `TEST_PLAN.md`). If a document in this folder contradicts them, **they win** and the specification here must be corrected.

**Audience:** any coding agent or engineer. Read [`../../AGENT_ADAPTER.md`](../../AGENT_ADAPTER.md), the root [`AGENTS.md`](../../AGENTS.md), and the scoped rule file for your target directory first.

---

## 1. How to use this folder

1. Read §4–§8 here once. They hold the conventions every task depends on.
2. Open the single specification file for your task.
3. Follow the universal task loop in `AGENT_ADAPTER.md` §4.
4. Report using `AGENT_ADAPTER.md` §7.

One task per file. A specification file never restates a contract it can cite — it points at the authoritative section and states only what the implementer must decide, build, and prove.

Each spec has the same sections: **Task · Dependencies · Blocked by · Requirements · Scope boundary · Normative inputs · Implementation requirements · Acceptance criteria · Tests · Definition of Done**.

## 2. Backend specifications

| Spec | Title | Depends on | Requirements |
|---|---|---|---|
| [`BE-01`](BE-01.md) | Workspace, processes and infrastructure bootstrap | — | `NFR-07` |
| [`BE-02`](BE-02.md) | Dashboard auth contract addendum, organizations and RBAC | `BE-01`, **ADR-01** | `FR-ORG-*`, `FR-SEC-01` |
| [`BE-03`](BE-03.md) | Prisma business schema, constraints, indexes and fixtures | `BE-01` | `FR-EVT-03/05`, `FR-DEL-01`, `FR-OBS-*` |
| [`BE-04`](BE-04.md) | Applications CRUD and disable policy | `BE-02`, `BE-03` | `FR-APP-*` |
| [`BE-05`](BE-05.md) | Producer API keys: create, verify, revoke | `BE-02`, `BE-03`, `BE-04` | `FR-KEY-*`, `FR-SEC-04` |
| [`BE-06`](BE-06.md) | Endpoints, subscriptions, URL validation and signing secrets | `BE-02`, `BE-03`, `BE-04` | `FR-END-*`, `FR-SEC-02` |
| [`BE-07`](BE-07.md) | Event publish: validation, transaction, idempotency | `BE-03`..`BE-06` | `FR-EVT-*`, `FR-DEL-01` |
| [`BE-08`](BE-08.md) | Outbox dispatcher, BullMQ enqueue and reconciliation | `BE-03`, `BE-07` | `FR-RET-04`, `NFR-01` |
| [`BE-09`](BE-09.md) | Worker: lease, safe egress, HMAC signing, attempts | `BE-06`, `BE-08` | `FR-DEL-*`, `FR-RET-*` |
| [`BE-10`](BE-10.md) | Bounded retry, lease recovery, UNKNOWN attempts, generations | `BE-09` | `FR-RET-*`, `NFR-03/04` |
| [`BE-11`](BE-11.md) | Read APIs: events, deliveries, attempts, usage summary | `BE-03`, `BE-07`, `BE-09` | `FR-OBS-*` |
| [`BE-12`](BE-12.md) | Manual replay with operation idempotency and audit | `BE-10`, `BE-11` | `FR-REP-*` |
| [`BE-13`](BE-13.md) | Rate limits, retention, metrics, health and runbook | `BE-05`, `BE-09`..`BE-12` | `FR-SEC-03/05/06`, `NFR-*` |
| [`BE-14`](BE-14.md) | Published OpenAPI, producer sample and HMAC verifier | `BE-02`, `BE-07`, `BE-09`, `BE-12` | `NFR-06` |

## 3. Frontend specifications

| Spec | Title | Depends on | Requirements |
|---|---|---|---|
| [`FE-01`](FE-01.md) | Application shell, routing and typed API client | `BE-01`, M0 fixtures | `UI-10` |
| [`FE-02`](FE-02.md) | Session guard, role-aware navigation, access-denied views | `BE-02`, `FE-01`, **ADR-01** | `UI-01`, `FR-ORG-*` |
| [`FE-03`](FE-03.md) | Applications screens and integration instructions | `BE-04`, `FE-01/02` | `UI-03`, `FR-APP-*` |
| [`FE-04`](FE-04.md) | Endpoints screens, subscriptions and secret rotation dialog | `BE-06`, `FE-03` | `UI-04/05`, `FR-END-*` |
| [`FE-05`](FE-05.md) | Admin API keys with one-time key dialog | `BE-05`, `FE-02/03` | `UI-06`, `FR-KEY-*` |
| [`FE-06`](FE-06.md) | Events list and detail with cursor pagination | `BE-11`, `FE-03` | `UI-07`, `FR-OBS-01` |
| [`FE-07`](FE-07.md) | Deliveries list, detail and attempt timeline | `BE-11`, `FE-04/06` | `UI-08/09`, `FR-OBS-02/04` |
| [`FE-08`](FE-08.md) | Replay confirmation, operation idempotency and race UX | `BE-12`, `FE-07` | `UI-09`, `FR-REP-*` |
| [`FE-09`](FE-09.md) | Usage dashboard, accessibility and responsive pass | `BE-11`, `FE-01/06/07` | `UI-02/10` |
| [`FE-10`](FE-10.md) | Browser E2E, documentation examples, secret hardening | `FE-02`..`FE-09`, `BE-14` | `UX-AC-01..10` |

### Milestone mapping (`IMPLEMENTATION_PLAN.md` §2)

| Milestone | Tasks | Gate to proceed |
|---|---|---|
| M0 — Contracts & setup | `BE-01`, `FE-01`, ADR-01 addendum in `BE-02` | security-sensitive Phase 2 open questions resolved |
| M1 — Ingest & durable routing | `BE-02`..`BE-07` | same-key duplicate safe, no subscribers handled, Redis down does not lose an accepted event |
| M2 — Reliable delivery | `BE-08`..`BE-10` | failure injection and independent endpoint delivery pass |
| M3 — Management UI | `FE-02`..`FE-05` | self-service pilot workflow in a browser; secrets shown once |
| M4 — Incident recovery | `BE-11`, `BE-12`, `FE-06`..`FE-08` | replay/idempotency/race tests pass; history preserved |
| M5 — Pilot hardening | `BE-13`, `BE-14`, `FE-09`, `FE-10` | QA release gate green; no open severity-1/2 defects |

---

## 4. Rules that apply to every task

Every specification in this folder assumes the repository invariants **INV-01**..**INV-12** in [`AGENTS.md`](../../AGENTS.md) §4. They are maintained there as the single source and are cited by ID in each specification's acceptance criteria. They are deliberately not reproduced here, so that they cannot drift.

The ones most frequently decisive in this phase:

| ID | Short form | Tasks where it is load-bearing |
|---|---|---|
| **INV-01** | tenant scope from the principal; non-owned ID returns `404` | every route task: `BE-02`, `BE-04`..`BE-07`, `BE-11`, `BE-12` |
| **INV-02** | `202` only after the publish transaction commits | `BE-07` |
| **INV-03** | PostgreSQL authoritative, Redis coordination only | `BE-08`, `BE-09`, `BE-10` |
| **INV-04** | the database owns the retry schedule; `attempts: 1` | `BE-08`, `BE-09`, `BE-10` |
| **INV-05** | no external I/O inside a transaction | `BE-07`, `BE-08`, `BE-09`, `BE-10` |
| **INV-06** | idempotency from database constraints | `BE-03`, `BE-07`, `BE-12` |
| **INV-07** | public HTTPS only; validate the connected IP; no redirects | `BE-06`, `BE-09` |
| **INV-08** | credentials revealed once and never recorded | `BE-05`, `BE-06`, `FE-04`, `FE-05`, `FE-10` |
| **INV-09** | history is append-only | `BE-03`, `BE-10`, `BE-12`, `BE-13` |
| **INV-10** | at-least-once, never exactly-once | `BE-09`, `BE-10`, `FE-07`, `FE-08`, `FE-10` |
| **INV-11** | schema change ships with a reviewed migration | `BE-03`, and any later schema touch |
| **INV-12** | never report an unexecuted verification | every task |

Process rules — the task loop, conflict reporting and the report template — are in [`AGENT_ADAPTER.md`](../../AGENT_ADAPTER.md) §4, §6 and §7.

## 5. Open ADRs — what is blocked

`IMPLEMENTATION_PLAN.md` §8. Do not silently resolve any of these. Implement only the parts independent of the decision and report the blocker.

| ADR | Decision needed | Blocks |
|---|---|---|
| **ADR-01** | dashboard auth / session / invitation / CSRF contract | `BE-02`, `FE-02`, and therefore every authenticated screen |
| **ADR-02** | immediate vs overlap signing-secret rotation; which version pending deliveries use | `BE-06`, `BE-09` (secret version snapshot), `FE-04` |
| **ADR-03** | effect of disabling an application on pending deliveries | `BE-04`, `FE-03` |
| **ADR-04** | retry schedule, max attempts, max age, timeout, payload cap, retention, tenant quotas | `BE-09`, `BE-10`, `BE-13` |
| **ADR-05** | exact outbound header/body version and published OpenAPI | `BE-09`, `BE-14` |
| **ADR-06** | Bun/NestJS/Prisma/BullMQ runtime compatibility matrix | `BE-01` (resolve here) |

Where a task needs an undecided value, the specification names the **pilot proposal** from `PRD.md` §7 / `SYSTEM_ARCHITECTURE.md` §8 and requires it to be implemented as configuration — never hardcoded, never presented as final.

## 6. Shared workspace conventions

### 6.1 Root scripts

Established by `BE-01`; referenced verbatim by CI and by every task report. Extend this list rather than inventing names.

| Script | Purpose |
|---|---|
| `typecheck` | TypeScript project-wide, no emit |
| `lint` / `format:check` | ESLint / Prettier |
| `test` | unit and component tests across workspaces |
| `test:integration` | DB and queue integration tests (requires Compose) |
| `test:e2e` | browser E2E (added by `FE-10`) |
| `db:migrate` / `db:migrate:deploy` / `db:generate` | Prisma lifecycle |
| `dev:api` / `dev:dispatcher` / `dev:worker` / `dev:web` | run one process |
| `compose:up` / `compose:down` | infrastructure lifecycle |

### 6.2 Repository layout

Per `TECHNICAL_DESIGN.md` §1:

```text
apps/api  apps/dispatcher  apps/worker  apps/web
packages/contracts  packages/config
prisma/                 # single centralized schema + migrations
infrastructure/         # docker-compose.yml, raw SQL migrations
docs/
```

`packages/contracts` is the only place public contract types are shared. The frontend never hand-copies a backend DTO.

### 6.3 Error and pagination envelopes

Every management and producer route uses the envelopes fixed in `API_SPECIFICATION.md` §1:

```json
{"error":{"code":"idempotency_conflict","message":"...","request_id":"req_...","details":{}}}
{"data":[],"next_cursor":null}
```

Cursor pagination only: `?limit=20&cursor=...`, default 20, max 100, deterministic `(created_at, id)` ordering. No offset pagination, no fabricated totals. Error `code` values form one stable catalog — add to it deliberately, never ad hoc.

## 7. Environment contract

Validated by a fail-fast schema in `packages/config` (`TECHNICAL_DESIGN.md` §10). A process refuses to start on invalid configuration. A later task that needs a new variable adds it here.

| Variable | Used by | Notes |
|---|---|---|
| `NODE_ENV`, `LOG_LEVEL` | all | |
| `DATABASE_URL`, `DATABASE_POOL_SIZE` | api, dispatcher, worker | pool sized per process |
| `REDIS_URL` | api, dispatcher, worker | BullMQ connection |
| `API_PORT`, `API_BASE_URL` | api, web | |
| `SECRET_ENCRYPTION_KEY` | api, worker | master key for endpoint signing secrets (`BE-06`) |
| `WORKER_CONCURRENCY` | worker | bounded (`BE-09`) |
| `DISPATCHER_POLL_INTERVAL_MS` | dispatcher | outbox poll cadence (`BE-08`) |
| `DISPATCHER_PROBE_PORT` | dispatcher | health/readiness listener (`BE-01`) |
| `WORKER_PROBE_PORT` | worker | health/readiness listener (`BE-01`) |
| `DELIVERY_TIMEOUT_MS`, `DELIVERY_MAX_ATTEMPTS`, `DELIVERY_BACKOFF_BASE_MS`, `DELIVERY_MAX_AGE_MS`, `DELIVERY_MAX_RESPONSE_BYTES` | worker | ADR-04 values as configuration (`BE-09`, `BE-10`) |
| `PUBLISH_MAX_BODY_BYTES`, `RATE_LIMIT_*` | api | ADR-04 values as configuration (`BE-07`, `BE-13`) |
| `RETENTION_*` | api, jobs | ADR-04 retention policy (`BE-13`) |
| `VITE_API_BASE_URL` | web | build-time only; not a secret |

Secret-bearing variables are never logged, printed in CI, committed, or echoed in an agent report. `.env.example` is committed with placeholders; `.env` never is.

`DISPATCHER_PROBE_PORT` and `WORKER_PROBE_PORT` were added by `BE-01`: `apps/dispatcher` and `apps/worker` are NestJS application contexts, not HTTP servers, so each needs an explicit port for the minimal health/readiness listener required by `BE-01` §6.2–§6.3.

`RATE_LIMIT_*` and `RETENTION_*` are named as groups above but have no concrete variable names yet. Their names and values are part of `ADR-04` and are defined by `BE-13`; `BE-01` deliberately did not invent them. The Compose-only variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT`) are local infrastructure credentials read by `infrastructure/docker-compose.yml` and by no application process.

## 8. ADR-06 runtime gate

Resolved inside `BE-01`. `TECHNICAL_DESIGN.md` §1 requires the runtime choice to be **verified** against the exact pinned versions of Bun, NestJS, Prisma and BullMQ: NestJS bootstrap, a Prisma query, a BullMQ enqueue plus consume, and the test runner. If all pass, Bun is package manager and runtime. If any fails, Bun stays the package manager and the NestJS processes run on a supported Node.js LTS, with no architectural change. Record the matrix and the decision in the `BE-01` report; later tasks assume it is settled.

## 9. Phase exit criteria

Phase 1 is complete when the pilot acceptance scenario in `IMPLEMENTATION_PLAN.md` §7 passes end to end, and:

| # | Criterion | Source |
|---|---|---|
| 1 | All `BE-01`..`BE-14` and `FE-01`..`FE-10` Definitions of Done are met | each spec |
| 2 | `QA-E2E-01`..`12`, `QA-RES-01`..`06`, `QA-CON-01`..`06` pass | `TEST_PLAN.md` §3–§4 |
| 3 | `QA-AUTH-01`..`05` and `QA-SEC-01`..`10` pass with no exception | `TEST_PLAN.md` §5 |
| 4 | `QA-API-01`..`04`, `QA-DB-01`..`04`, `QA-UI-01`..`08` pass | `TEST_PLAN.md` §6 |
| 5 | `UX-AC-01`..`10` verified in a browser | `UI_UX_SPECIFICATION.md` §6 |
| 6 | `typecheck`, `lint`, `test`, `test:integration`, `test:e2e` green in CI | §6.1 |
| 7 | ADR-01..ADR-06 all resolved and reflected in the documents | `IMPLEMENTATION_PLAN.md` §8 |
| 8 | No secret value in any log, test output, CI output, fixture or committed file | §4 rule 6 |
| 9 | Published OpenAPI plus an independent HMAC verifier that passes against real traffic | `BE-14`, `NFR-06` |

**No-go** if tenant isolation, SSRF, signing, durable acceptance, duplicate-safe idempotency, replay auditability or recovery tests are failing (`IMPLEMENTATION_PLAN.md` §8).

## 10. Specification template

When adding a task specification to this folder, follow the structure in §1 and keep these properties: cite authoritative sections instead of restating them; name requirement IDs for every behavior; state the scope boundary explicitly, including what belongs to a neighbouring task; name the ADR that blocks any undecided value; and make every acceptance criterion observable by a test.
