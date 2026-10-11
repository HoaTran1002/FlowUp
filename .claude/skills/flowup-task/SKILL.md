---
name: flowup-task
description: Execute a FlowUp implementation task (BE-01..BE-14 or FE-01..FE-10) under the repository's engineering standards. Use when the user asks to implement, continue, or verify a FlowUp task by its ID, or says things like "implement BE-07", "start the publish endpoint", "do the next backend task", or "check this change against our standards". Loads the rule stack, resolves the task specification, enforces the task loop and the required report format.
---

# FlowUp Task Execution

Execute one FlowUp implementation task correctly, under the repository standards, and report honestly.

## 1. Resolve the task

Determine the task ID from the user's request.

- An explicit ID (`BE-07`, `FE-04`) is the task.
- "The next task" means: read `docs/phase-1/README.md` §2–§3 for the dependency columns and the milestone map, check the repository state for what is already implemented, and propose the next unblocked task. State the choice and why before starting.
- A request that maps to no `BE-XX`/`FE-XX` task is out of scope until a document is updated — say so rather than inventing work (`AGENTS.md` §2.4).

## 2. Load the rule stack

Read, in this order. Do not skip a step because the file "looks familiar" — these govern the work.

1. `AGENTS.md` — repository standard. §4 holds the invariants `INV-01`..`INV-12`.
2. `AGENT_ADAPTER.md` — process contract: task loop (§4), conflict template (§6), report template (§7).
3. The scoped standard: `apps/api/AGENTS.md` for a `BE-XX` task, `apps/web/AGENTS.md` for an `FE-XX` task.
4. `docs/phase-1/README.md` §4–§8 — invariant map, open-ADR map, workspace conventions, environment contract.
5. `docs/phase-1/<TASK-ID>.md` — the task's specification. This is the working document.
6. The document sections that the specification's **Normative inputs** names. Read them; do not work from memory of a document you did not open this session.

## 3. Check the blockers first

The specification's **Blocked by** line names the ADRs that gate the task. Before writing code:

- If an ADR blocks the task entirely (`ADR-01` for `BE-02` and `FE-02`), deliver nothing, state the blocker, and stop.
- If an ADR blocks only a value — a timeout, a retry count, a payload cap, a retention window — implement the mechanism now and the value as configuration, carrying the documented pilot proposal as its default. Never hardcode it and never present it as final.
- If an ADR blocks a semantic (`ADR-02` rotation cutover, `ADR-03` disable effect), implement the settled part, leave the undecided part behind one named code path, and report it.

Confirm the task's upstream dependencies are actually done. If not, say so and either stop or proceed under an explicitly stated assumption.

## 4. Execute

Follow `AGENT_ADAPTER.md` §4 steps 4–10: inspect existing code, plan minimally, implement, test, verify, review the diff.

While implementing, hold these in view — they are the recurring failure modes in this codebase:

- **Tenant scope** comes from the authenticated principal, never from request input; a non-owned ID returns `404` (INV-01).
- **`202` requires a commit.** The publish path returns accepted only after the transaction containing event, delivery snapshots and outbox intents commits (INV-02).
- **No external I/O in a transaction** — no HTTP, no Redis, no DNS (INV-05).
- **One retry authority.** The database owns the schedule; BullMQ jobs are `attempts: 1` (INV-04).
- **Idempotency from database constraints**, not in-process state or job retention (INV-06).
- **Egress is public HTTPS only**, with the resolved and connected IP validated and redirects disabled (INV-07).
- **Credentials appear exactly once**, in the creation or rotation response, and nowhere else — not logs, jobs, cache, storage, URLs, fixtures or snapshots (INV-08).
- **History is append-only** (INV-09), and delivery is **at-least-once, never exactly-once** (INV-10).

Add the test layers the specification's **Tests** section lists. Do not weaken an invariant to make a test pass.

## 5. Verify

Run the repository scripts named in `docs/phase-1/README.md` §6.1 — `typecheck`, `lint`, `test`, and `test:integration` where the change touches the database or the queue. Use the real commands; do not invent script names.

Record what each command actually returned. If you cannot run a command — no shell, no Docker, no dependencies installed — label it `NOT RUN` with the reason. Reporting an unexecuted check as passing violates INV-12 and is a defect in itself.

## 6. Report

Close with the template in `AGENT_ADAPTER.md` §7, and additionally:

- Name the `INV-*` IDs the change touched and confirm each still holds.
- Walk the specification's **Acceptance criteria** table and state, per row, whether it is met, not met, or unverified.
- Name the open ADRs that still block this task or the tasks downstream of it.
- State explicitly anything you left out of scope, and why.

Never describe unfinished work as complete. A partially blocked task delivers every unblocked part in full and says exactly what was left out.
