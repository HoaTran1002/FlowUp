# FlowUp Web — Coding Agent Rules

Scope: `apps/web/**`. This file supplements the repository-root `AGENTS.md`. Use approved FlowUp product, API and UI/UX specifications as the source of truth; frontend must not invent backend behavior.

## 1. Task protocol (mandatory)

1. Identify the `FE-XX` task and dependencies in `docs/IMPLEMENTATION_PLAN.md`.
2. Read the related `docs/URD.md`, `docs/PRD.md`, `docs/API_SPECIFICATION.md`, `docs/UI_UX_SPECIFICATION.md`, and `docs/TEST_PLAN.md` sections; capture `FR-*`, `UI-*`, `UX-AC-*`, `QA-*` references.
3. Inspect existing components, routes, API client, tests and shared contracts before coding.
4. Implement only the task; preserve existing UI patterns and accessibility.
5. Run appropriate typecheck/lint/unit/component/E2E checks; review changed files and report what was actually verified.

For missing endpoints/fields, request a contract update or use explicit, typed fixtures in tests/story previews. Never make up production API fields or hardcode simulated success paths. Auth bootstrap (ADR-01) is unresolved until a documented session/invitation/CSRF contract is approved; do not assume localStorage bearer tokens.

## 2. Approved stack and organization

- React + TypeScript; Bun workspaces; Vite (as specified in implementation plan).
- TanStack Router for routes and authenticated layouts.
- TanStack Query for all server state, cache invalidation, polling where justified and mutations.
- Axios through one shared, typed API client. Do not scatter raw `fetch` or ad hoc Axios instances across components.
- shadcn/ui and Tailwind CSS for consistent accessible components.
- Use feature-oriented folders for applications, endpoints, API keys, events, deliveries, usage and authentication. Keep pages as composition boundaries; extract focused reusable components only after a clear need.
- Prefer local component state for UI interactions. Do not add a global state library, a second data-fetching library or a competing component system without explicit approval.
- Use generated types from OpenAPI/approved `packages/contracts` when available. Do not duplicate backend DTO definitions by hand.

## 3. API contract and access control

- `docs/API_SPECIFICATION.md` is authoritative for routes, methods, payloads, pagination, status codes and the error envelope. Use `/v1` and the shared Axios client.
- Management API is based on authenticated human session/CSRF protocol, not producer publishing API keys. Never place `flw_...` machine keys in the dashboard HTTP client for normal requests.
- Show role-aware navigation: Admin-only API keys and membership functions; Admin/Developer can manage permitted resources as documented. Client guards improve UX but **server authorization is mandatory**; handle `401`, `403` and `404` correctly.
- Do not use caller-supplied `organization_id` to bypass tenant scoping. Do not guess the resource exists when the server returns `404`.
- Implement common Axios error normalization for `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429`, and `5xx`; display actionable messages without revealing sensitive details.
- Handle cursor pagination (`data`, `next_cursor`) with stable filters. Never assume offset pagination or fabricate totals not supplied by API.

## 4. Authentication and secrets handling

- Follow the approved dashboard session and CSRF contract after ADR-01. Do not implement persistent JavaScript-readable auth tokens by default.
- API keys and signing secrets are displayed **only in the immediate successful creation/rotation response**. Provide a one-time copy action and explicit warning that the value will not be shown again.
- Never put raw keys/secrets into URLs, browser storage, analytics, application logs, error-reporting payloads or persisted TanStack Query cache. For one-time creation dialogs, keep the raw secret in ephemeral component state, clear it on close/navigation/unmount, and never refetch it.
- Metadata screens must show masked identifiers/status/creation dates only, not raw credentials.
- Never render unsanitized API-supplied HTML. Avoid `dangerouslySetInnerHTML`; display webhook payloads as escaped text/JSON, with truncation or redaction where required.

## 5. UX and workflow rules

Implement the UI states in `docs/UI_UX_SPECIFICATION.md`:
- Authentication and organization access (`UI-01`), overview (`UI-02`).
- Applications (`UI-03`) and endpoints/subscriptions/secret rotation (`UI-04`, `UI-05`).
- Admin API keys (`UI-06`).
- Events list/detail (`UI-07`), deliveries list/detail (`UI-08`, `UI-09`).
- Consistent shell, responsive layouts and states (`UI-10`).

Business semantics must be accurate:
- One event may create zero or multiple independent deliveries. Show accepted/no-subscribers honestly; do not invent delivery records.
- A failed **attempt** is not necessarily a final failed **delivery**. Show status, next retry, attempt number, and UNKNOWN outcome distinctly.
- Manual replay is available only for final `FAILED` deliveries and eligible users. Require a clear confirmation; pass an operation idempotency key and disable duplicate submission. Handle `202` as scheduled, **not delivered**; handle `409` with refresh/recovery guidance.
- When disabling an application or endpoint, explain the pending/in-flight effect using the approved policy; do not silently assume cancellation behavior.
- Show URL validation and SSRF errors returned by the server. Frontend input checks improve UX but never replace backend enforcement.
- Show errors and empty/loading/success states for all relevant screens, not only happy paths.

## 6. Data fetching and state management

- Define centralized query-key factories with organization/resource scope. Invalidate only affected queries after writes; avoid blanket cache clears.
- Use `useQuery`/`useMutation` with correct loading and error states. Provide safe retry behavior; avoid replaying non-idempotent mutations automatically without an approved idempotency policy.
- Preserve filters, sorting and cursor state across navigation where the UX specification requires it.
- Prefer server-derived delivery state to optimistic 'success'. No UI assertion that webhook was delivered unless the API reports `SUCCEEDED`.
- Use polling only when useful for pending/retry states, with bounded interval and cleanup. Do not add WebSockets/SSE without a documented requirement.
- Keep timezone display explicit while respecting UTC timestamps from API; avoid hardcoded sample counts in production dashboards.

## 7. Design, accessibility and responsive behavior

- Use the existing shadcn/ui primitives and Tailwind tokens; do not add a new visual system or copy-paste large custom widgets unnecessarily.
- All forms need labels, inline validation and disabled/submitting/error states.
- Dialogs: focus management, keyboard operation, clear cancel/confirm semantics. Destructive actions require confirmation.
- Tables: stable columns, responsive overflow, truncation/tooltip for long IDs and URLs; do not cause layout shifts when filtering/sorting.
- Keyboard navigation, accessible names, focus indicators, contrast, loading announcements and sensible empty states are required.
- Keep copy precise: `accepted`, `queued`, `retrying`, `failed`, `replay scheduled` are distinct states.

## 8. Verification and tests

- Unit/component tests for form validation, permission-aware UI, error states, one-time secret dialog and delivery semantics.
- Mocked API tests using approved contract fixtures; browser E2E for the pilot flow against real services where available.
- Cover UI acceptance criteria `UX-AC-01..10`, including: secret disappears after refresh, Developer denied API key screen, no subscribers, endpoint A succeeds while B fails, replay/409 race, session expiry, cursor filtering, responsive/keyboard behavior.
- Never claim server-side authorization or security is proven by hiding UI controls; verify backend tests cover it.
- Do not snapshot full raw keys, signatures, private payloads or customer data in tests or artifacts.

## 9. Definition of Done and final report

Done means the approved task and UX acceptance criteria are implemented, all relevant UI states work, data follows the API contract, tests/typecheck/lint pass where runnable, and no new secret exposure or accessibility regressions are introduced.

Report:
- Task/requirements: `FE-XX`, `UI-*`, `UX-AC-*`.
- Changes: routes, components, hooks and files touched.
- API dependencies: verified endpoints or documented blockers.
- Verification: exact commands and results.
- Remaining issues: blocked states, ADRs or tests not executed.
