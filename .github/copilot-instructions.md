# FlowUp — GitHub Copilot

FlowUp is a multi-tenant outbound webhook delivery platform. This repository keeps one canonical rule set; this file is a pointer only.

Read before writing code, in order:

1. `AGENTS.md` — repository rules (authoritative).
2. `AGENT_ADAPTER.md` — rule loading, document resolution order, the universal task loop, and the required report format.
3. `apps/api/AGENTS.md` for backend work, `apps/web/AGENTS.md` for frontend work.
4. The task row in `docs/IMPLEMENTATION_PLAN.md`, or the matching document in `docs/phase-1/` for workspace setup.

Stack: TypeScript, NestJS, Bun, Prisma, PostgreSQL, BullMQ, Redis; React, TanStack Query/Router, Axios, shadcn/ui, Tailwind CSS.

Never: invent API routes or response fields, weaken tenant isolation or SSRF protection, log or store secrets, claim exactly-once delivery, or claim a test passed without running it. See `AGENT_ADAPTER.md` §8.
