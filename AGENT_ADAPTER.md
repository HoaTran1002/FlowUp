# FlowUp — Agent Adapter Specification

**Purpose:** a single, tool-agnostic entry point so that *any* coding agent (Claude Code, Cursor, GitHub Copilot, Gemini CLI, Codex, Windsurf, Aider, Cline, or a human) can load FlowUp's rules, resolve the authoritative documents, execute a task, and report results in the same way.

**Status:** Normative process contract. It does **not** restate product requirements, API contracts, or architecture. Those live in `docs/` and in the `AGENTS.md` rule files, which remain authoritative.

**Rule of precedence (highest first):**

1. Explicit, in-session instruction from the human operator.
2. Approved documents in `docs/` (priority order in §3).
3. Scoped rule file for the directory being edited (`apps/api/AGENTS.md`, `apps/web/AGENTS.md`).
4. Repository-root `AGENTS.md`.
5. This adapter (process only).
6. Agent defaults and general conventions.

If a lower-precedence source conflicts with a higher one, the higher one wins. If two *documents* conflict, do not pick silently — see §6.

---

## 1. Rule loading for any agent

FlowUp keeps exactly one copy of each rule set. Tool-specific files are **pointers**, never duplicates.

| Canonical file | Applies to | Loaded when |
|---|---|---|
| `AGENTS.md` (root) | whole repository | always |
| `apps/api/AGENTS.md` | `apps/api/**`, plus shared backend modules used by `apps/worker` and `apps/dispatcher` | any backend task |
| `apps/web/AGENTS.md` | `apps/web/**` | any frontend task |
| `AGENT_ADAPTER.md` (this file) | process, hand-off, reporting | always |

Adapter pointer files that different tools auto-load:

| Tool | File it reads | Content |
|---|---|---|
| Claude Code / Claude Desktop | `CLAUDE.md` | pointer to `AGENTS.md` + this file |
| Cursor | `.cursor/rules/flowup.mdc` | pointer |
| GitHub Copilot | `.github/copilot-instructions.md` | pointer |
| Gemini CLI | `GEMINI.md` | pointer |
| Windsurf | `.windsurfrules` | pointer |
| Codex / Aider / Cline / others | `AGENTS.md` (de facto standard) | canonical |

**If your tool is not listed:** read `AGENTS.md`, then this file, then the scoped `AGENTS.md` for the directory you are about to touch. Do not create a new rule file with copied content; add a pointer file instead and keep the canonical rules in one place.

**Minimum context an agent must have loaded before writing code:**

- root `AGENTS.md`
- the scoped `AGENTS.md` for the target directory
- the per-task specification in `docs/phase-1/` (`BE-XX.md` / `FE-XX.md`), which cites the task row in `docs/IMPLEMENTATION_PLAN.md`
- the sections of the documents in §3 that the task row references

An agent that cannot load these must say so and stop, rather than guess.

---

## 2. Capability profile — what an agent must declare

Agents differ in what they can actually do. Before starting, determine and state which of these you have:

| Capability | Needed for | If absent |
|---|---|---|
| Read repository files | every task | cannot proceed |
| Write/modify files | implementation tasks | produce a reviewed patch/diff instead |
| Run shell commands | typecheck, lint, tests, migrations, Docker | you **must** label every check as `NOT RUN` and never claim it passed |
| Network access | dependency install, OpenAPI fetch | request the human to install dependencies |
| Docker | Postgres/Redis, Compose smoke tests | mark integration/recovery tests as unverified |

**Hard rule:** never report a verification you did not execute. "Tests not run (no shell access)" is an acceptable report. "Tests pass" without execution is a defect.

---

## 3. Document resolution order

Authoritative documents, highest priority first:

1. `docs/PRODUCT_OVERVIEW.md` — product identity and scope boundary
2. `docs/URD.md` — user/business requirements (`UR-*`)
3. `docs/PRD.md` — functional behavior (`FR-*`, `NFR-*`, `AT-*`)
4. `docs/SYSTEM_ARCHITECTURE.md` — system boundaries, invariants, `ADR-*`
5. `docs/DATABASE_DESIGN.md` — persistence contracts
6. `docs/API_SPECIFICATION.md` — API contracts (`/v1`)
7. `docs/TECHNICAL_DESIGN.md` — implementation decisions
8. `docs/UI_UX_SPECIFICATION.md` — UX (`UI-*`, `UX-AC-*`)
9. `docs/IMPLEMENTATION_PLAN.md` — tasks, dependencies, milestones
10. `docs/TEST_PLAN.md` — verification requirements (`QA-*`)
11. `docs/phase-1/*` — per-task build specifications (derived; see §5)

`docs/phase-1/` is **derived guidance**: one specification file per `BE-XX`/`FE-XX` task, telling you how to implement it. If it ever contradicts documents 1–10, documents 1–10 win and the specification must be corrected.

### Requirement ID vocabulary

| Prefix | Meaning | Source |
|---|---|---|
| `UR-*` | user requirement | `URD.md` |
| `FR-*` | functional requirement | `PRD.md` |
| `NFR-*` | non-functional requirement | `PRD.md` |
| `AT-*` | acceptance test | `PRD.md` |
| `QA-*` | test-plan case | `TEST_PLAN.md` |
| `UI-*`, `UX-AC-*` | screen / UX acceptance | `UI_UX_SPECIFICATION.md` |
| `BE-*`, `FE-*` | implementation task | `IMPLEMENTATION_PLAN.md` |
| `ADR-*` | architecture decision (some still open) | `SYSTEM_ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` §8 |

Every change must trace to at least one ID. If no ID covers the work, the work is out of scope until a document is updated and approved.

---

## 4. Universal task loop

Follow these steps in order for every task, regardless of agent.

**Step 1 — Identify.** State the task ID (`BE-XX` / `FE-XX`), its objective, and its acceptance criteria verbatim from its specification in `docs/phase-1/` and the plan.

**Step 2 — Check dependencies.** Confirm the upstream tasks in the plan's dependency graph are done. If not, say so and either stop or implement behind an explicit, stated assumption.

**Step 3 — Read.** Load the referenced document sections. Quote the specific constraints you must satisfy (routes, status codes, constraint names, state transitions). Do not work from memory of a doc you did not open in this session.

**Step 4 — Inspect.** Read the existing code, Prisma schema, migrations, tests, and call sites you are about to touch. Never create a parallel implementation of something that exists.

**Step 5 — Check open ADRs.** If the task touches an unresolved ADR (`ADR-01` dashboard auth/session/CSRF, `ADR-02` secret rotation, `ADR-03` disable effect on pending deliveries, `ADR-04` retry/limits/retention, `ADR-05` outbound header/body version, `ADR-06` Bun runtime matrix), do **not** silently resolve it. Implement only the parts independent of the decision, and report the blocker.

**Step 6 — Plan minimally.** Describe the smallest change satisfying the criteria: files to add/modify, migrations, tests. No unrelated refactors, no new dependencies without justification, no features outside the MVP.

**Step 7 — Implement.** Respect module boundaries; thin controllers; business logic in application services; infrastructure separated; no circular dependencies.

**Step 8 — Test.** Add or update tests matching the change (unit, DB integration, API contract, worker integration, security/authorization, recovery, E2E as applicable).

**Step 9 — Verify.** Run typecheck, lint, and the relevant tests. Record the exact commands and their real results.

**Step 10 — Review the diff.** Read your own change end to end. Look for leaked secrets, missing tenant scoping, missing migration, broken contract, dead code.

**Step 11 — Report.** Use the format in §7.

---

## 5. Phase mapping

| Phase | Documents | Implementation tasks |
|---|---|---|
| 1 — Product definition | `PRODUCT_OVERVIEW.md`, `URD.md`, `PRD.md` | — |
| 2 — Design | `SYSTEM_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_SPECIFICATION.md`, `TECHNICAL_DESIGN.md` | — |
| 3 — Planning | `UI_UX_SPECIFICATION.md`, `IMPLEMENTATION_PLAN.md`, `TEST_PLAN.md` | — |
| Build phase 1 — v0.1 pilot | `docs/phase-1/README.md` (conventions, ADR gates, exit criteria) plus one spec per task: `docs/phase-1/BE-01.md`..`BE-14.md`, `FE-01.md`..`FE-10.md` | `BE-01`..`BE-14`, `FE-01`..`FE-10` |

Setup work (`BE-01`, `FE-01`) is the only work permitted before `ADR-01` is resolved, and even then it must not implement an authentication scheme. `docs/phase-1/README.md` §5 lists what each open ADR blocks.

---

## 6. Conflict, ambiguity and scope handling

**Document conflict.** Report it explicitly in this form, and propose a resolution. Do not choose silently.

```
CONFLICT
  Document A: <file> §<section> says <quote>
  Document B: <file> §<section> says <quote>
  Impact: <what cannot be implemented unambiguously>
  Proposed resolution: <which should win and why>
  Blocking: yes | no (what can proceed meanwhile)
```

**Missing contract.** If an endpoint, field, or response code you need is not in `docs/API_SPECIFICATION.md`, do not invent it. Backend: request a contract addendum. Frontend: use explicit typed fixtures in tests/previews only, never a fabricated production field.

**Out-of-scope request.** FlowUp v0.1 is not a CRM, marketing automation tool, workflow builder, event transformation engine, billing system, AI feature, connector marketplace, or enterprise SSO product. If asked for one, state that it is outside the approved MVP and ask for a documented scope change.

**Security-sensitive ambiguity.** Default to the stricter interpretation. Never weaken tenant isolation, SSRF protection, signing, or secret handling to make a test pass or to simplify an implementation.

---

## 7. Required final report (all agents)

```
Task: <BE-XX / FE-XX> — <title>
Requirements: <FR-*, NFR-*, UI-*, UX-AC-*, QA-*, AT-*>

Implemented:
  - <behavior-level summary, not a file listing>

Files Changed:
  - <path> — <why>

Contracts & Migrations:
  - API contract: unchanged | changed (<approval reference>)
  - Prisma migration: none | <migration name>

Verification:
  - <exact command> -> PASS | FAIL | NOT RUN (<reason>)

Remaining Issues:
  - <blockers, open ADRs, tests not executed, known limitations>

Documentation Impact:
  - <docs that need updating, or "none">
```

Rules for the report: name every command you ran and its real outcome; list every check you skipped and why; never describe unfinished work as complete; state the open ADRs you were blocked by.

---

## 8. Non-negotiable invariants (quick reference)

Independent of task or agent, the following must never be violated. Full rationale is in `AGENTS.md` and the scoped rule files.

1. **Tenant isolation.** Resolve `organization_id` from the authenticated principal, never from caller input. Scope every query and mutation.
2. **Durable acceptance.** Return `202` for a published event only after the PostgreSQL transaction containing the event, delivery snapshots, and outbox intents has committed. Redis availability must not affect acceptance.
3. **PostgreSQL is authoritative.** Redis/BullMQ is execution coordination only, never the only durable record of business state.
4. **One retry authority.** The database owns the retry schedule; each BullMQ job performs one attempt (`attempts: 1`). Never stack a second queue-level retry loop on top.
5. **No external I/O inside a database transaction.** No HTTP calls, no Redis enqueue.
6. **At-least-once, never exactly-once.** Do not claim or imply exactly-once delivery anywhere in code, UI, or docs.
7. **Idempotency from the database.** Uniqueness constraints arbitrate duplicates, not in-process maps or BullMQ job IDs.
8. **Safe egress.** HTTPS and globally routable destinations only; block loopback, private, link-local, multicast, and cloud-metadata ranges for IPv4 and IPv6; validate the resolved and connected IP, not only the URL string; redirects disabled in v0.1.
9. **Secrets shown once.** API keys stored as hashes, signing secrets encrypted and versioned. Raw values appear only in the immediate creation/rotation response — never in logs, queue jobs, browser storage, query cache, analytics, URLs, or tests.
10. **History is append-only.** Never rewrite or delete accepted events, delivery attempts, or audit entries to simplify replay.
11. **Migrations accompany schema changes.** No schema drift, no untracked SQL.
12. **Honest verification.** Never claim a check ran when it did not.
