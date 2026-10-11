# FlowUp — Claude Code

This repository keeps one canonical rule set. Do not duplicate rules here.

Read, in order, before writing code:

1. [`AGENTS.md`](AGENTS.md) — repository rules (authoritative).
2. [`AGENT_ADAPTER.md`](AGENT_ADAPTER.md) — how any agent loads rules, resolves documents, executes a task, and reports.
3. The scoped rule file for the directory you are editing: [`apps/api/AGENTS.md`](apps/api/AGENTS.md) for backend, [`apps/web/AGENTS.md`](apps/web/AGENTS.md) for frontend.
4. The task row in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md), or the matching document in [`docs/phase-1/`](docs/phase-1/) for workspace setup.

Approved documents in `docs/` are the source of truth. Report document conflicts instead of resolving them silently. Use the final report format in `AGENT_ADAPTER.md` §7.
