# FlowUp — Engineering Standards for AI Coding Agents

**Document type:** Normative repository standard · **Applies to:** every contributor, human or agent, in every directory
**Version:** 1.1 · **Supersedes:** FlowUp — AI Coding Agent Rules v1.0

---

## 1. Purpose and Conformance

### 1.1 Purpose

This document is the authoritative engineering standard for the FlowUp repository. It defines the product boundary, the document precedence, the non-negotiable invariants, and the standards that all code must satisfy.

### 1.2 Normative language

Requirement keywords are used as defined in RFC 2119:

- **MUST** / **MUST NOT** — an absolute requirement. A change violating it is rejected, regardless of test results.
- **SHOULD** / **SHOULD NOT** — a strong recommendation. Deviation requires a stated, reviewed reason in the task report.
- **MAY** — genuinely optional.

### 1.3 Precedence of this document

1. An explicit in-session instruction from the human operator.
2. The authoritative product documents (§3.1).
3. The scoped standard for the directory being changed (§3.4).
4. This document.
5. `AGENT_ADAPTER.md` (process only).
6. Agent defaults and general convention.

A lower-ranked source MUST NOT override a higher-ranked one.

### 1.4 Conformance

Work conforms when: every **MUST** in this document is satisfied; every invariant in §4 holds; the task's acceptance criteria in its `docs/phase-1/` specification pass; and the report in §11 is accurate.

---

## 2. Product Identity and Scope Boundary

### 2.1 Identity

FlowUp is a multi-tenant outbound webhook delivery platform. It receives events from authenticated producers, persists them durably, routes them to configured HTTPS endpoints, delivers them asynchronously, retries failures within a bounded policy, and provides delivery observability.

**Core principle:** Publish once. Deliver reliably. Debug easily.

### 2.2 Scope boundary

FlowUp v0.1 is **not** a CRM, a marketing automation platform, a general-purpose workflow builder, an event transformation engine, or a replacement for an ERP or commerce platform.

### 2.3 Exclusions

The following MUST NOT be introduced into v0.1: billing, public self-signup at scale, a consumer portal, inbound third-party connectors, event transformation or filtering languages, workflow orchestration, enterprise SSO, multi-region deployment, AI features, an SDK ecosystem, Kafka or another broker, and microservice decomposition.

### 2.4 Scope control

A feature outside §2.1 MUST NOT be implemented, scaffolded, or prepared for. A request for one MUST be answered by stating that it is outside the approved MVP and asking for a documented scope change.

---

## 3. Document Precedence

Before implementing a task, an agent MUST: read the relevant documentation; identify the requirement IDs; review the existing implementation; identify dependencies and acceptance criteria; and implement only the requested scope.

### 3.1 Authoritative documents (priority order)

| # | Document | Contains |
|---|---|---|
| 1 | `docs/PRODUCT_OVERVIEW.md` | Product identity and scope boundary |
| 2 | `docs/URD.md` | User and business requirements (`UR-*`) |
| 3 | `docs/PRD.md` | Functional behavior (`FR-*`, `NFR-*`, `AT-*`) |
| 4 | `docs/SYSTEM_ARCHITECTURE.md` | System boundaries, invariants, `ADR-*` |
| 5 | `docs/DATABASE_DESIGN.md` | Persistence contracts |
| 6 | `docs/API_SPECIFICATION.md` | API contracts (`/v1`) |
| 7 | `docs/TECHNICAL_DESIGN.md` | Implementation decisions |
| 8 | `docs/UI_UX_SPECIFICATION.md` | User experience (`UI-*`, `UX-AC-*`) |
| 9 | `docs/IMPLEMENTATION_PLAN.md` | Tasks, dependencies, milestones (`BE-*`, `FE-*`) |
| 10 | `docs/TEST_PLAN.md` | Verification requirements (`QA-*`) |

### 3.2 Derived documents

These are derived from §3.1 and rank below it. Where a derived document contradicts an authoritative one, the authoritative one wins and the derived document MUST be corrected.

| # | Document | Contains |
|---|---|---|
| 11 | `docs/phase-1/README.md` | Build-phase index, cross-task rules, open-ADR map, environment contract, exit criteria |
| 12 | `docs/phase-1/BE-XX.md`, `docs/phase-1/FE-XX.md` | One implementation specification per task: scope boundary, implementation requirements, acceptance criteria, tests, Definition of Done |
| 13 | `docs/STANDARDS_ALIGNMENT.md` | Industry-standard gap analysis; informative, changes no contract |

An implementation task MUST be opened from its `docs/phase-1/` specification, not from the plan table alone.

### 3.3 Process contract

`AGENT_ADAPTER.md` defines the tool-agnostic process: rule loading and precedence, capability declaration, document resolution, the task loop, conflict reporting, and the report template. It governs *how* to work and MUST NOT override §3.1. Tool-specific files (`CLAUDE.md`, `.cursor/rules/*`, `.github/copilot-instructions.md`, `GEMINI.md`, `.windsurfrules`) are pointers and carry no rules of their own.

### 3.4 Scoped standards

`apps/api/AGENTS.md` and `apps/web/AGENTS.md` supplement this document for their directories and rank above it there. They MUST NOT restate an invariant from §4; they cite it by ID.

### 3.5 Conflicts and change control

If two documents conflict, an agent MUST NOT silently choose one. It MUST report the conflict using the template in `AGENT_ADAPTER.md` §6 and propose a resolution.

Requirements and API contracts MUST NOT be modified without explicit authorization. A contract change MUST be approved and documented before the code that depends on it is written.

---

## 4. Non-Negotiable Invariants

These are the correctness and safety properties of the product. Each has a stable ID. Specifications, reviews and reports cite them by ID. An invariant MUST NOT be weakened to make a test pass, to simplify an implementation, or to meet a deadline.

| ID | Invariant | Source |
|---|---|---|
| **INV-01** | Tenant scope MUST be resolved from the authenticated principal, never from caller-supplied input. Every query and mutation MUST be organization-scoped. An existing but non-owned resource MUST return `404`, with no cross-tenant existence signal. | `FR-SEC-01`, `NFR-02` |
| **INV-02** | A published event MUST be acknowledged `202` only after the PostgreSQL transaction containing the event, its delivery snapshots and its dispatch intents has committed. Queue availability MUST NOT affect acceptance. | `FR-EVT-03/04/08`, `NFR-01` |
| **INV-03** | PostgreSQL is the authoritative record of business state. Redis and BullMQ are execution coordination only and MUST NOT be the sole durable record of anything. | `SYSTEM_ARCHITECTURE.md` §3 |
| **INV-04** | The database owns the retry schedule. Each BullMQ job MUST perform exactly one attempt (`attempts: 1`). A second, queue-level retry loop MUST NOT exist. | `TECHNICAL_DESIGN.md` §4 |
| **INV-05** | External I/O — HTTP, Redis, DNS — MUST NOT occur inside a database transaction. | `AGENTS.md` §6.2 |
| **INV-06** | Business idempotency MUST derive from database uniqueness constraints, never from in-process state or BullMQ job retention. | `FR-EVT-05/06` |
| **INV-07** | Outbound delivery MUST target public HTTPS destinations only. Loopback, private, link-local, multicast, reserved and cloud-metadata ranges MUST be blocked for IPv4 and IPv6. The resolved and connected IP MUST be validated — not only the URL string — and redirects are disabled in v0.1. | `FR-SEC-02`, `NFR-05` |
| **INV-08** | A credential MUST be revealed exactly once, in its creation or rotation response. API keys are stored hashed; signing secrets are stored encrypted and versioned. No credential, signature, raw payload or downstream response body may appear in logs, queue jobs, browser storage, query cache, analytics, URLs, error bodies, fixtures or test artifacts. | `FR-KEY-02`, `FR-END-03`, `FR-SEC-04`, `FR-OBS-05` |
| **INV-09** | History is append-only. Accepted events, delivery attempts and audit entries MUST NOT be rewritten, renumbered or deleted to simplify an implementation. | `FR-REP-02`, `FR-RET-06` |
| **INV-10** | Delivery is at-least-once. Exactly-once MUST NOT be claimed or implied in code, UI, logs, documentation or reports; duplicate consumer receipt MUST be stated honestly. | `NFR-03` |
| **INV-11** | A schema change MUST ship with a Prisma migration in the centralized location, with the generated SQL reviewed. | `AGENTS.md` §6.4 |
| **INV-12** | A verification MUST NOT be reported unless it was executed. Unrun checks MUST be labelled as such with the reason. | §11.2 |

---

## 5. Technology Standards

### 5.1 Approved stack

| Layer | Technology |
|---|---|
| Backend | TypeScript, NestJS, Prisma, PostgreSQL, BullMQ, Redis |
| Frontend | React, TypeScript, TanStack Router, TanStack Query, Axios, shadcn/ui, Tailwind CSS |
| Tooling | Bun workspaces, Docker Compose, environment-based configuration |

### 5.2 Dependency control

The existing stack MUST be used. A new framework, broker, database, state library, data-fetching library or component system MUST NOT be introduced without a concrete, stated need and approval. Any new dependency MUST be justified in the task report.

### 5.3 Runtime

Bun is the package manager and workspace tool. Use of Bun as the *runtime* for the NestJS processes depends on the **ADR-06** compatibility matrix resolved in `BE-01`; the approved fallback is Bun as package manager with a supported Node.js LTS runtime, with no architectural change.

---

## 6. Architecture and Engineering Standards

### 6.1 Architecture

- The system MUST remain a modular monolith: controllers → application services → domain, persistence and infrastructure adapters.
- Module boundaries MUST be respected. Circular dependencies between modules MUST NOT be introduced.
- Controllers MUST stay thin. Business decisions MUST live in independently testable application services.
- Infrastructure concerns MUST be separated from business rules.
- `apps/api`, `apps/dispatcher` and `apps/worker` MUST remain separately runnable processes sharing approved modules. The HTTP process MUST NOT run an uncontrolled delivery loop.
- Unnecessary abstractions, speculative generality and unrelated refactors MUST NOT be added. Prefer simple, maintainable code.

### 6.2 Backend

- NestJS dependency injection MUST be used; configuration MUST be read through the validated config package, never from `process.env` directly.
- Untrusted input MUST be validated at the server boundary with explicit DTOs and types.
- API contracts MUST be explicit and versioned; public contracts are shared only through `packages/contracts`.
- Database transactions MUST be applied to atomic business operations, subject to INV-05.
- Errors MUST be handled explicitly and MUST NOT be silently swallowed. Logging MUST be structured.
- Idempotency MUST be preserved across retries (INV-06).

### 6.3 Asynchronous execution

- Jobs MUST carry identifiers only — never complete event payloads and never secrets.
- Workers MUST load authoritative state from PostgreSQL (INV-03).
- A retried job MUST NOT create a duplicate business record (INV-06, INV-09).
- Concurrency, timeout and lease limits MUST be respected and bounded. Stalled and repeated jobs MUST be accounted for.
- Manual replay history MUST be preserved (INV-09).

### 6.4 Persistence

- Prisma schema changes MUST be accompanied by a reviewed migration (INV-11).
- Queries MUST be organization-scoped with deterministic ordering for cursors (`created_at`, `id`). N+1 queries and unbounded scans on event, delivery and attempt tables MUST be avoided.
- Historical delivery and attempt correctness MUST be preserved across schema changes.
- A deviation from `docs/DATABASE_DESIGN.md` MUST be flagged explicitly before it is applied.

### 6.5 Frontend

- Code MUST be organized by feature. Components MUST stay small and focused.
- TanStack Query MUST be used for all server state; TanStack Router for routing; Axios through the single shared, typed client.
- shadcn/ui and Tailwind MUST be used consistently; a competing visual system MUST NOT be added.
- Unnecessary global state MUST NOT be introduced.
- Loading, empty, success and error states MUST be implemented for every screen; layouts MUST be responsive.
- Destructive actions MUST require explicit confirmation.
- Backend endpoints and response fields MUST NOT be invented; `docs/API_SPECIFICATION.md` is authoritative (INV-08 governs secrets).

Detailed backend and frontend rules are in the scoped standards (§3.4).

---

## 7. Security Standards

Security is mandatory, including for the MVP. INV-01, INV-07 and INV-08 are the load-bearing requirements; this section states the operational detail.

- Authorization MUST be verified server-side for every operation. A hidden UI control is never an access control.
- Human session authentication and machine publishing keys are separate, non-interchangeable modes.
- Webhook signing MUST follow the documented contract, over the exact bytes sent.
- Request and payload limits MUST be enforced; least-privilege access MUST be applied.
- Another tenant's events, endpoints, deliveries or logs MUST NOT be exposed under any circumstance.
- Audit records MUST be created for credential, endpoint, permission and replay mutations.

---

## 8. Verification Standards

### 8.1 Test selection

Tests appropriate to the change MUST be added or updated: unit tests for business rules; integration tests for database and queue behavior; API contract tests; E2E tests for critical workflows; security tests for authorization boundaries; and recovery tests for delivery failure scenarios.

### 8.2 Mandatory webhook scenarios

Where a change touches delivery, the following MUST be covered: successful delivery; timeout; retryable HTTP failure; permanent failure; duplicate event publishing; worker crash; manual replay; tenant isolation; and SSRF protection.

### 8.3 Execution honesty

A task MUST NOT be marked complete unless the relevant checks have passed. If a check could not be executed, the report MUST state exactly what was not verified and why (INV-12).

---

## 9. Delivery Process

The task loop is defined in `AGENT_ADAPTER.md` §4 and MUST be followed: identify, check dependencies, read, inspect, check open ADRs, plan minimally, implement, test, verify, review the diff, report.

An agent MUST NOT: implement unrelated features; refactor unrelated modules; add an unjustified dependency; modify production configuration unnecessarily; change a database schema without a migration; introduce a breaking API change silently; or claim a test passed without executing it.

Where a task depends on an unresolved ADR, the agent MUST implement only the parts independent of the decision and report the blocker. An undecided numeric limit MUST be implemented as configuration carrying the documented pilot proposal as its default, never as a hardcoded constant presented as final.

---

## 10. Definition of Done

A task is complete only when all of the following hold:

1. The requested behavior is implemented and the acceptance criteria in its `docs/phase-1/` specification pass.
2. Every applicable invariant in §4 holds.
3. Relevant tests pass, and type checking and linting pass.
4. No known critical security issue is introduced.
5. Existing contracts remain compatible unless a change was approved in advance.
6. Migrations are committed with reviewed SQL where the schema changed.
7. Documentation is updated where the change requires it.
8. The report in §11 is complete and accurate.

---

## 11. Reporting

### 11.1 Required report

Every task MUST end with a report in the template in `AGENT_ADAPTER.md` §7, covering: task and requirement IDs; what was implemented; files changed; contract and migration impact; verification commands with real results; remaining issues and blocking ADRs; and documentation impact.

### 11.2 Reporting integrity

- Every command named MUST have been executed, and its stated outcome MUST be its real outcome.
- A skipped check MUST be labelled `NOT RUN` with the reason.
- Unfinished work MUST NOT be reported as complete.
- A partially blocked task MUST deliver every unblocked part in full and state explicitly what was left out and why.

---

## 12. Change Control for This Document

This document is versioned. A change to §2 (scope), §4 (invariants) or §5.1 (stack) is a governance change requiring explicit authorization and a version increment. Editorial changes to other sections SHOULD note the version. An invariant MUST NOT be removed or weakened without a recorded decision naming the authorizing party.
