# FlowUp — AI Coding Agent Rules

## 1. Project Identity

FlowUp is a multi-tenant outbound webhook delivery platform.

Its responsibility is to receive events from authenticated producers, persist them, route them to configured HTTP endpoints, deliver them asynchronously, retry failures, and provide delivery observability.

**Core principle:** Publish once. Deliver reliably. Debug easily.

FlowUp v0.1 is NOT:

- A CRM or marketing automation platform.
- A general-purpose workflow builder.
- An event transformation engine.
- A replacement for ERP or commerce platforms.

Do not introduce features outside the approved MVP.

## 2. Documentation Is the Source of Truth

Before implementing a task:

1. Read the relevant project documentation.
2. Identify related requirement IDs.
3. Review the existing implementation.
4. Identify dependencies and acceptance criteria.
5. Implement only the requested scope.

Documentation priority:

1. `PRODUCT_OVERVIEW.md` — Product identity and scope.
2. `URD.md` — User and business requirements.
3. `PRD.md` — Functional behavior.
4. `SYSTEM_ARCHITECTURE.md` — System boundaries.
5. `DATABASE_DESIGN.md` — Persistence contracts.
6. `API_SPECIFICATION.md` — API contracts.
7. `TECHNICAL_DESIGN.md` — Implementation decisions.
8. `UI_UX_SPECIFICATION.md` — User experience.
9. `IMPLEMENTATION_PLAN.md` — Tasks and dependencies.
10. `TEST_PLAN.md` — Verification requirements.

If documents conflict, do not silently choose one. Report the conflict and propose a resolution.

Do not modify requirements or API contracts without explicit authorization.

## 3. Technology Stack

Backend:

- TypeScript
- NestJS
- Bun
- Prisma
- PostgreSQL
- BullMQ
- Redis

Frontend:

- React
- TypeScript
- TanStack Query
- TanStack Router
- Axios
- shadcn/ui
- Tailwind CSS

Infrastructure:

- Docker Compose
- Environment-based configuration

Use the existing stack. Do not introduce frameworks, brokers, databases, or libraries without a concrete need.

## 4. Architecture Rules

- Follow modular monolith architecture.
- Respect module boundaries.
- Keep controllers thin.
- Put business logic in application services.
- Keep infrastructure concerns separate from business rules.
- Avoid circular dependencies.
- Do not implement microservices unless explicitly requested.
- Avoid unnecessary abstractions and generic frameworks.
- Prefer simple, maintainable code.

PostgreSQL is the source of truth for persisted business state.

Redis/BullMQ is used for asynchronous execution, not as the authoritative event store.

## 5. Backend Rules

- Use NestJS dependency injection.
- Validate untrusted input.
- Keep API contracts explicit and versioned.
- Use Prisma migrations for schema changes.
- Apply database transactions for atomic business operations.
- Never perform external HTTP delivery inside a database transaction.
- Preserve idempotency.
- Use structured logging.
- Handle errors explicitly.
- Never silently swallow errors.

For webhook delivery:

- Persist accepted events durably.
- Use the approved outbox mechanism.
- Treat each event-endpoint delivery independently.
- Record delivery attempts.
- Handle retries according to the approved policy.
- Support recovery from worker crashes.
- Assume at-least-once execution.
- Do not claim exactly-once delivery.

## 6. BullMQ Rules

- Jobs should contain identifiers rather than complete event payloads or secrets.
- Delivery workers must load authoritative state from PostgreSQL.
- Retried jobs must not create duplicate business records.
- Do not rely exclusively on BullMQ job IDs for business idempotency.
- Respect concurrency and timeout limits.
- Persist retry-relevant business state when required by the technical design.
- Account for stalled or repeated jobs.
- Preserve manual replay history.

## 7. Frontend Rules

- Organize code by features.
- Use TanStack Query for server-state management.
- Use TanStack Router for routing.
- Use Axios through the shared API client.
- Use shadcn/ui components consistently.
- Keep components small and focused.
- Avoid unnecessary global state.
- Implement loading, empty, success, and error states.
- Support responsive layouts.
- Use explicit confirmation for destructive actions.
- Never store API secrets in browser-accessible persistent storage.

Do not invent backend endpoints or response fields.

Follow `API_SPECIFICATION.md`.

## 8. Security Rules

Security is mandatory, even for the MVP.

- Enforce tenant isolation on every protected resource.
- Verify authorization for every operation.
- Store API keys as secure hashes.
- Never expose credentials in logs.
- Apply webhook signing according to the documented contract.
- Prevent SSRF when delivering to user-configured URLs.
- Block internal, loopback, link-local, and cloud metadata destinations.
- Validate DNS resolution and connection destination safely.
- Enforce request and payload limits.
- Use least-privilege access.
- Do not expose another tenant's events, endpoints, or delivery logs.

## 9. Testing Rules

Every completed task must satisfy its acceptance criteria.

Use tests appropriate to the change:

- Unit tests for business rules.
- Integration tests for database and queue behavior.
- API contract tests.
- E2E tests for critical workflows.
- Security tests for authorization boundaries.
- Recovery tests for delivery failure scenarios.

Webhook-specific scenarios include:

- Successful delivery.
- Timeout.
- Retryable HTTP failure.
- Permanent failure.
- Duplicate event publishing.
- Worker crash.
- Manual replay.
- Tenant isolation.
- SSRF protection.

Do not mark a task complete unless the relevant checks have passed.

If tests cannot be executed, explicitly state what was not verified.

## 10. Task Execution Rules

For each implementation task:

1. Identify task ID and objective.
2. Read relevant requirements and dependencies.
3. Inspect existing code.
4. Prepare a minimal implementation approach.
5. Implement the requested changes.
6. Add or update relevant tests.
7. Run appropriate quality checks.
8. Review the final diff.
9. Summarize completed work and remaining risks.

Do not:

- Implement unrelated features.
- Refactor unrelated modules.
- Add dependencies without justification.
- Modify production configuration unnecessarily.
- Change database schemas without migrations.
- Introduce breaking API changes silently.
- Claim tests passed without executing them.

## 11. Definition of Done

A task is complete only when:

- Requested behavior is implemented.
- Requirements and acceptance criteria are satisfied.
- Relevant tests pass.
- Type checking passes.
- No known critical security issue is introduced.
- Existing contracts remain compatible unless a change was approved.
- Documentation is updated when necessary.

## 12. Required Final Report

At the end of each task, report:

**Task:** Task ID and title

**Implemented:** Summary of changes

**Files Changed:** Relevant files

**Verification:** Commands executed and results

**Remaining Issues:** Known limitations or blockers

**Documentation Impact:** Any required updates

Never report unfinished work as completed.
