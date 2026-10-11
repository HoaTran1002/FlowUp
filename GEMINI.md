# FlowUp — Gemini CLI

This repository keeps one canonical rule set. Do not duplicate rules here.

Read, in order, before writing code:

1. `AGENTS.md` — repository rules (authoritative).
2. `AGENT_ADAPTER.md` — how any agent loads rules, resolves documents, executes a task, and reports.
3. The scoped rule file for the directory you are editing: `apps/api/AGENTS.md` (backend) or `apps/web/AGENTS.md` (frontend).
4. The task row in `docs/IMPLEMENTATION_PLAN.md`, or that task's specification in `docs/phase-1/` (`BE-XX.md` / `FE-XX.md`).

Approved documents in `docs/` are the source of truth. Report document conflicts instead of resolving them silently. Use the final report format in `AGENT_ADAPTER.md` §7.
