# FlowUp Frontend — Scoped Engineering Standard

**Document type:** Normative scoped standard · **Version:** 1.1
**Scope:** `apps/web/**`.
**Precedence:** supplements the repository standard `AGENTS.md` and ranks above it for this directory; both rank below the approved product documents (`AGENTS.md` §1.3). Requirement keywords follow `AGENTS.md` §1.2. The invariants **INV-01**..**INV-12** in `AGENTS.md` §4 apply in full and are cited here by ID rather than restated. The frontend MUST NOT invent backend behavior.

---

## 1. Task Protocol

The task loop in `AGENT_ADAPTER.md` §4 MUST be followed. Frontend tasks additionally MUST:

1. Open the task from its specification in `docs/phase-1/FE-XX.md` and confirm its dependencies.
2. Read the cited sections of `docs/URD.md`, `docs/PRD.md`, `docs/API_SPECIFICATION.md`, `docs/UI_UX_SPECIFICATION.md` and `docs/TEST_PLAN.md`, capturing `FR-*`, `UI-*`, `UX-AC-*` and `QA-*` references.
3. Inspect the existing components, routes, API client, tests and shared contracts before coding.
4. Implement only the task, preserving existing UI patterns and accessibility.
5. Run the appropriate typecheck, lint, unit, component and E2E checks, review the changed files, and report what was actually verified (INV-12).

A missing endpoint or field MUST trigger a contract-update request, or explicit typed fixtures confined to tests and previews. A production API field MUST NOT be fabricated and a success path MUST NOT be hardcoded. Auth bootstrap (**ADR-01**) is unresolved until a documented session, invitation and CSRF contract is approved; a `localStorage` bearer token MUST NOT be assumed.

## 2. Stack and Organization

1. React with TypeScript, Bun workspaces and Vite as specified in the implementation plan.
2. TanStack Router for routes and authenticated layouts.
3. TanStack Query for all server state, cache invalidation, justified polling and mutations.
4. Axios through one shared, typed API client. Raw `fetch` and ad hoc Axios instances MUST NOT be scattered across components.
5. shadcn/ui and Tailwind CSS for consistent, accessible components.
6. Feature-oriented folders for applications, endpoints, API keys, events, deliveries, usage and authentication. Pages are composition boundaries; a reusable component is extracted only after a clear need.
7. Local component state SHOULD be preferred for UI interaction. A global state library, a second data-fetching library or a competing component system MUST NOT be added without explicit approval.
8. Generated types from the OpenAPI contract or `packages/contracts` MUST be used where available. Backend DTOs MUST NOT be duplicated by hand.

## 3. API Contract and Access Control

1. `docs/API_SPECIFICATION.md` is authoritative for routes, methods, payloads, pagination, status codes and the error envelope. The `/v1` base and the shared Axios client MUST be used.
2. The management API uses an authenticated human session with CSRF protection, not a producer publishing key. A `flw_...` machine key MUST NOT be placed in the dashboard HTTP client for any request (INV-08).
3. Navigation MUST be role-aware: Admin-only API key and membership functions; Admin and Developer manage permitted resources as documented. A client guard improves UX only — server authorization is mandatory and is the sole gate. `401`, `403` and `404` MUST be handled distinctly.
4. A caller-supplied `organization_id` MUST NOT be used to influence scoping (INV-01). A `404` MUST NOT be reinterpreted as the resource existing elsewhere.
5. Common Axios error normalization MUST cover `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429` and `5xx`, plus network and timeout errors, displaying actionable messages without revealing internals.
6. Cursor pagination (`data`, `next_cursor`) MUST be handled with stable filters. Offset pagination MUST NOT be assumed and totals MUST NOT be fabricated.

## 4. Authentication and Credential Handling

1. The approved dashboard session and CSRF contract MUST be followed once **ADR-01** is resolved. A persistent JavaScript-readable auth token MUST NOT be implemented by default.
2. API keys and signing secrets are displayed only in the immediate successful creation or rotation response (INV-08). A one-time copy action and an explicit warning that the value will not be shown again MUST be provided.
3. A raw key or secret MUST NOT be placed in a URL, browser storage, analytics, application logs, error-reporting payloads or a persisted TanStack Query cache. In a one-time dialog the raw value MUST be held in ephemeral component state, cleared on close, navigation and unmount, and never refetched.
4. Metadata screens MUST show masked identifiers, status and creation dates only — never a raw credential.
5. Unsanitized API-supplied HTML MUST NOT be rendered. `dangerouslySetInnerHTML` MUST NOT be used. Webhook payloads MUST be displayed as escaped text or JSON, with truncation or redaction where required.

## 5. Domain Semantics in the UI

The states in `docs/UI_UX_SPECIFICATION.md` MUST be implemented: authentication and organization access (`UI-01`), overview (`UI-02`), applications (`UI-03`), endpoints with subscriptions and secret rotation (`UI-04`, `UI-05`), Admin API keys (`UI-06`), events (`UI-07`), deliveries (`UI-08`, `UI-09`), and the global shell and states (`UI-10`).

Business semantics MUST be accurate:

1. One event may create zero or many independent deliveries. Accepted and no-subscriber outcomes MUST be shown honestly and a delivery record MUST NOT be invented.
2. A failed **attempt** is not necessarily a final failed **delivery**. Status, next retry, attempt number and an `UNKNOWN` outcome MUST be shown distinctly.
3. Manual replay is available only for final `FAILED` deliveries and eligible users. It MUST require clear confirmation, pass an operation idempotency key, and disable duplicate submission. `202` means scheduled, **not** delivered; `409` MUST produce refresh and recovery guidance.
4. When an application or endpoint is disabled, the pending and in-flight effect MUST be explained using the approved policy. Cancellation of an in-flight request MUST NOT be implied.
5. Server-returned URL validation and SSRF errors MUST be surfaced accurately. Client-side input checks improve UX but never replace backend enforcement.
6. Loading, empty, success and error states MUST be implemented for every relevant screen, not only happy paths.

## 6. Data Fetching and State

1. Query-key factories MUST be centralized and scoped by organization and resource. After a write, only the affected queries may be invalidated; blanket cache clears MUST NOT be used.
2. `useQuery` and `useMutation` MUST carry correct loading and error states. Retry behavior MUST be safe; a non-idempotent mutation MUST NOT be replayed automatically without an approved idempotency policy.
3. Filters, sorting and cursor state MUST be preserved across navigation where the UX specification requires it.
4. Server-derived delivery state MUST be preferred over optimistic success. The UI MUST NOT assert that a webhook was delivered unless the API reports `SUCCEEDED` (INV-10).
5. Polling MAY be used for pending and retry states only, with a bounded interval and cleanup. WebSockets or SSE MUST NOT be added without a documented requirement.
6. Timezone display MUST be explicit while respecting the API's UTC timestamps. Hardcoded sample counts MUST NOT appear in a production dashboard.

## 7. Design, Accessibility and Responsiveness

1. Existing shadcn/ui primitives and Tailwind tokens MUST be used; a new visual system or large copy-pasted widgets MUST NOT be introduced unnecessarily.
2. Forms MUST have labels, inline validation and disabled, submitting and error states.
3. Dialogs MUST manage focus, be keyboard-operable and have clear cancel and confirm semantics. Destructive actions MUST require confirmation.
4. Tables MUST keep stable columns, handle responsive overflow, truncate long IDs and URLs with a tooltip, and MUST NOT shift layout when filtering or sorting.
5. Keyboard navigation, accessible names, focus indicators, WCAG AA contrast, announced loading states and sensible empty states are required.
6. Copy MUST be precise: `accepted`, `queued`, `retrying`, `failed` and `replay scheduled` are distinct states.

## 8. Verification

1. Unit and component tests MUST cover form validation, permission-aware UI, error states, the one-time secret dialog and delivery semantics.
2. Mocked API tests MUST use approved contract fixtures; browser E2E MUST exercise the pilot flow against real services where available.
3. The UI acceptance criteria `UX-AC-01`..`UX-AC-10` MUST be covered, including: the secret disappearing after refresh; a Developer denied the API key screen; no subscribers; endpoint A succeeding while B fails; the replay and `409` race; session expiry; cursor filtering; and responsive and keyboard behavior.
4. Server-side authorization MUST NOT be claimed as proven by hiding a UI control; backend coverage MUST be cited instead.
5. Full raw keys, signatures, private payloads and customer data MUST NOT appear in tests, snapshots or artifacts (INV-08).

## 9. Definition of Done and Report

Done means: the approved task and UX acceptance criteria are implemented; all relevant UI states work; data follows the API contract; tests, typecheck and lint pass where runnable; and no new credential exposure or accessibility regression is introduced.

The report template in `AGENT_ADAPTER.md` §7 MUST be used, naming: the task and requirement IDs including `INV-*`; the routes, components, hooks and files touched; verified API dependencies or documented blockers; the exact verification commands with real results; and remaining blocked states, ADRs and unexecuted tests.
