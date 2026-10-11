# FlowUp — Agent Process Contract

**Document type:** Normative process standard · **Applies to:** every coding agent and every human contributor
**Version:** 1.1 · **Governs:** *how* work is done. It MUST NOT override the product documents or `AGENTS.md`.

Its purpose is that any agent — Claude Code, Cursor, GitHub Copilot, Gemini CLI, Codex, Windsurf, Aider, Cline, or a human — loads the same rules, resolves the same documents, executes the same loop, and reports in the same format.

This document does **not** restate product requirements, API contracts, architecture, or the invariants. Those live in `docs/` and in `AGENTS.md` §4.

Requirement keywords (**MUST**, **SHOULD**, **MAY**) are used as defined in `AGENTS.md` §1.2.

---

## 1. Rule Loading

### 1.1 Canonical rule files

FlowUp keeps exactly one copy of each rule set. Tool-specific files are pointers and MUST NOT contain rules of their own.

| Canonical file | Applies to | Loaded |
|---|---|---|
| `AGENTS.md` | the whole repository | always |
| `AGENT_ADAPTER.md` (this file) | process, hand-off, reporting | always |
| `apps/api/AGENTS.md` | `apps/api/**`, plus shared backend modules used by `apps/dispatcher` and `apps/worker` | any backend task |
| `apps/web/AGENTS.md` | `apps/web/**` | any frontend task |

### 1.2 Tool pointers

| Tool | File it auto-loads |
|---|---|
| Claude Code / Claude Desktop | `CLAUDE.md` |
| Claude Code skill | `.claude/skills/flowup-task/SKILL.md` (invoke as `/flowup-task`) |
| Cursor | `.cursor/rules/flowup.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Gemini CLI | `GEMINI.md` |
| Windsurf | `.windsurfrules` |
| Codex, Aider, Cline, others | `AGENTS.md` (de facto standard) |

An agent whose tool is not listed MUST read `AGENTS.md`, then this file, then the scoped standard for its target directory. It MUST NOT create a new rule file containing copied content; it adds a pointer instead.

### 1.3 Minimum loaded context

Before writing code, an agent MUST have loaded:

1. `AGENTS.md`;
2. this file;
3. the scoped standard for the target directory;
4. the task's specification in `docs/phase-1/` (`BE-XX.md` / `FE-XX.md`);
5. the sections of the documents in §3 that the specification cites.

An agent that cannot load these MUST say so and stop rather than guess.

### 1.4 Precedence

Precedence is defined in `AGENTS.md` §1.3 and MUST be observed as stated there.

---

## 2. Capability Declaration

Agents differ in what they can execute. Before starting, an agent MUST determine and state which capabilities it has.

| Capability | Needed for | If absent |
|---|---|---|
| Read repository files | every task | cannot proceed |
| Write or modify files | implementation | produce a reviewed patch instead |
| Run shell commands | typecheck, lint, tests, migrations, Docker | every check MUST be labelled `NOT RUN` |
| Network access | dependency install, contract fetch | ask the operator to install dependencies |
| Docker | PostgreSQL and Redis, Compose smoke tests | integration and recovery tests MUST be reported unverified |

Reporting a verification that was not executed violates `AGENTS.md` INV-12. "Tests not run (no shell access)" is an acceptable report; "tests pass" without execution is a defect.

---

## 3. Document Resolution

### 3.1 Priority

The authoritative and derived document order is defined in `AGENTS.md` §3.1–§3.2 and MUST be used for every resolution.

### 3.2 Requirement ID vocabulary

| Prefix | Meaning | Source |
|---|---|---|
| `UR-*` | user requirement | `docs/URD.md` |
| `FR-*` | functional requirement | `docs/PRD.md` |
| `NFR-*` | non-functional requirement | `docs/PRD.md` |
| `AT-*` | release acceptance test | `docs/PRD.md` |
| `QA-*` | test-plan case | `docs/TEST_PLAN.md` |
| `UI-*`, `UX-AC-*` | screen and UX acceptance | `docs/UI_UX_SPECIFICATION.md` |
| `BE-*`, `FE-*` | implementation task | `docs/IMPLEMENTATION_PLAN.md`, specified in `docs/phase-1/` |
| `ADR-*` | architecture decision, some still open | `docs/SYSTEM_ARCHITECTURE.md` §9, `docs/IMPLEMENTATION_PLAN.md` §8 |
| `INV-*` | non-negotiable invariant | `AGENTS.md` §4 |

Every change MUST trace to at least one requirement ID. Work that no ID covers is out of scope until a document is updated and approved.

---

## 4. Task Loop

An agent MUST follow these steps in order, for every task.

| # | Step | Requirement |
|---|---|---|
| 1 | **Identify** | State the task ID, its objective, and its acceptance criteria verbatim from its `docs/phase-1/` specification. |
| 2 | **Check dependencies** | Confirm the upstream tasks in the dependency graph are done. If not, stop or proceed under an explicitly stated assumption. |
| 3 | **Read** | Load the cited document sections and quote the constraints that bind the work — routes, status codes, constraint names, state transitions. Working from remembered documentation is not permitted. |
| 4 | **Inspect** | Read the existing code, schema, migrations, tests and call sites to be touched. A parallel implementation of something that exists MUST NOT be created. |
| 5 | **Check open ADRs** | If the task touches an unresolved ADR, implement only the independent parts and report the blocker (`AGENTS.md` §9). |
| 6 | **Plan minimally** | Describe the smallest change satisfying the criteria: files, migrations, tests. No unrelated refactor, no unjustified dependency, no out-of-scope feature. |
| 7 | **Implement** | Respect module boundaries and the engineering standards in `AGENTS.md` §6. |
| 8 | **Test** | Add or update the test layers the change requires (`AGENTS.md` §8). |
| 9 | **Verify** | Run typecheck, lint and the relevant tests. Record the exact commands and their real results. |
| 10 | **Review the diff** | Read the change end to end, checking for leaked credentials, missing tenant scoping, a missing migration, a broken contract, or dead code. |
| 11 | **Report** | Use §7. |

---

## 5. Phase Map

| Phase | Documents | Tasks |
|---|---|---|
| 1 — Product definition | `PRODUCT_OVERVIEW.md`, `URD.md`, `PRD.md` | — |
| 2 — Design | `SYSTEM_ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_SPECIFICATION.md`, `TECHNICAL_DESIGN.md` | — |
| 3 — Planning | `UI_UX_SPECIFICATION.md`, `IMPLEMENTATION_PLAN.md`, `TEST_PLAN.md` | — |
| Build phase 1 — v0.1 pilot | `docs/phase-1/README.md` plus one specification per task, `BE-01.md`..`BE-14.md` and `FE-01.md`..`FE-10.md` | `BE-01`..`BE-14`, `FE-01`..`FE-10` |

`BE-01` and `FE-01` are the only tasks permitted before **ADR-01** is resolved, and they MUST NOT implement an authentication scheme. `docs/phase-1/README.md` §5 maps each open ADR to the tasks it blocks.

---

## 6. Conflict, Ambiguity and Scope

### 6.1 Document conflict

An agent MUST NOT silently choose between conflicting documents. It MUST report the conflict in this form:

```
CONFLICT
  Document A: <file> §<section> says <quote>
  Document B: <file> §<section> says <quote>
  Impact: <what cannot be implemented unambiguously>
  Proposed resolution: <which should win and why>
  Blocking: yes | no (what can proceed meanwhile)
```

### 6.2 Missing contract

If a needed endpoint, field or status code is absent from `docs/API_SPECIFICATION.md`, it MUST NOT be invented. Backend work requests a contract addendum; frontend work uses explicit typed fixtures in tests and previews only, never a fabricated production field.

### 6.3 Out-of-scope request

A request outside the boundary in `AGENTS.md` §2 MUST be answered by stating that it is outside the approved MVP and asking for a documented scope change.

### 6.4 Security-sensitive ambiguity

Where a security-relevant detail is ambiguous, the stricter interpretation MUST be chosen. An invariant MUST NOT be weakened to resolve an ambiguity.

---

## 7. Required Report

Every task MUST end with this report. Reporting-integrity rules are in `AGENTS.md` §11.2.

```
Task: <BE-XX / FE-XX> — <title>
Requirements: <FR-*, NFR-*, UI-*, UX-AC-*, QA-*, AT-*, INV-*>

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
  - <documents needing update, or "none">
```

---

## 8. Invariants

The non-negotiable invariants are **INV-01**..**INV-12** in `AGENTS.md` §4. They are maintained there as the single source and MUST be cited by ID in specifications, reviews and reports. They are not reproduced here, so that they cannot drift.

Before completing any task, an agent MUST confirm that every applicable invariant holds and MUST name in its report the ones the change touched.
