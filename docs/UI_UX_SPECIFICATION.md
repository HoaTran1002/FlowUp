# FlowUp — UI/UX Specification v0.1

**Status:** Draft for implementation | **Phase:** 3 | **Source of truth:** `PRODUCT_OVERVIEW.md`, `URD.md`, `PRD.md`, `API_SPECIFICATION.md`.
**Audience:** Frontend engineers, product QA, backend engineers. **Tech preference:** React, TypeScript, TanStack Router + Query, Axios, shadcn/ui, Tailwind CSS.

## 1. Product UX goal and guardrails

An integration developer should be able to **configure a recipient, copy a secret once, publish a sample event and diagnose every endpoint-level outcome** without asking FlowUp support. UI emphasizes delivery facts, not false guarantees: `202` means accepted, and HTTP 2xx means consumer acknowledged transport—not completed the consumer's business action.

- One authenticated organization workspace; v0.1 invite-only. Two presets: **Admin** and **Developer**. Admin alone manages API keys and memberships; developer manages applications/endpoints and can replay failed deliveries.
- `application` is a logical recipient scope, **not** a human identity. All event creation via producer API; no send-event button in dashboard MVP unless a documented sample API call is provided.
- Explicit states: loading/skeleton, empty, success, validation error, API error, permission denied, partial data, no-subscriber event, canceled delivery and retry wait.
- UTC timestamps in API; local display with timezone clearly indicated. Refresh manually and use a modest refetch interval only while visible for active deliveries; avoid claiming real-time guarantee.
- Never show raw signing secret or API key again after initial creation/rotation. Never store secret in localStorage, URL, analytics or logs.

## 2. Information architecture and roles

```text
/login (session bootstrap documented separately)
/app
  /overview
  /applications
  /applications/:applicationId
  /endpoints
  /endpoints/new
  /endpoints/:endpointId
  /events
  /events/:eventId
  /deliveries
  /deliveries/:deliveryId
  /api-keys                  [Admin only]
  /settings                 [profile/organization read-only in pilot]
```

Navigation: **Overview | Applications | Endpoints | Events | Deliveries | API Keys (Admin)**. Organization identity visible in shell header; no arbitrary tenant selector. Deep links retain filters in query parameters, but do not include sensitive payloads. No customer/consumer portal, billing, AI, workflow editor or advanced analytics in MVP.

## 3. Screen specifications

| ID | Screen / route | Required UI | Data and actions | Traceability |
|---|---|---|---|---|
| UI-01 | Login / workspace | Sign-in affordance, session expired/403, invite-required explanation | Auth session bootstrap is **open API design dependency**; don't invent auth endpoints | UR-01, FR-ORG-01/02 |
| UI-02 | Overview `/overview` | KPI cards for accepted events, delivered, final failures, pending; date filter; link to failed deliveries | `GET /v1/usage/summary` | UR-15, FR-OBS-06 |
| UI-03 | Applications list/detail | Name, status, created date; create/edit/disable; show application ID + sample publish payload | `GET/POST/PATCH /v1/applications` | UR-03, FR-APP-* |
| UI-04 | Endpoints list | Application, hostname, status, subscribed event types; filter; new endpoint CTA | `GET /v1/endpoints`, `GET /v1/applications` | UR-04/05, FR-END-* |
| UI-05 | Endpoint create/detail | HTTPS URL, display name, application picker, event type chips, enable/disable, rotate secret; warning about pending deliveries on disable | `POST/PATCH /v1/endpoints`, `POST /.../rotate-secret` | UR-04/05/10/14, FR-END-* |
| UI-06 | API keys (Admin) | Key name, scoped apps, prefix, last used, status; create and revoke actions | `GET/POST /v1/api-keys`, `POST /.../revoke` | UR-02, FR-KEY-* |
| UI-07 | Events list/detail | Time/type/application filters, event ID, recipient count, no-subscribers marker; detail includes authorized payload with copy-safe UI | `GET /v1/events`, `GET /v1/events/{id}` | UR-08, FR-OBS-01, FR-EVT-07 |
| UI-08 | Deliveries list | Status, endpoint, app, event ID, attempt count, next retry, time filters | `GET /v1/deliveries` | UR-08/11, FR-OBS-02 |
| UI-09 | Delivery detail | Status, snapshotted destination, generation, safe last error, per-attempt timeline, replay control | `GET /v1/deliveries/{id}`, `GET /.../attempts`, `POST /.../replay` | UR-09/11/12, FR-OBS-03/04, FR-REP-* |
| UI-10 | Global UX states | Error page, access denied, no permissions, expired session, copy success, 429 banner and retry | All API contract error envelopes | FR-SEC-*, NFR-* |

### UI-05 endpoint form validation

Required fields: application, name, public HTTPS URL, nonempty subscription list (product rule v0.1). Immediate client-side feedback for syntactically bad URL; **server remains authoritative** for DNS/IP/SSRF. Disallow redirect expectations. Existing URL changes affect *future* deliveries only; show a short inline notice. Disable modal: “Unsent pending deliveries will be cancelled. In-flight requests may finish.”

Secret lifecycle: creation/rotation opens a one-time modal with secret, `Copy`, and an explicit **I saved this secret** acknowledgement before closing. On later detail pages show only metadata/version, a rotate action and verification instructions. On refresh, secret is gone. Do not put secret in toast text, query cache persistence or telemetry.

### UI-06 API key workflow

Admin selects key label + allowed application IDs; one-time modal shows raw key. Revoke modal explains that new publishes are blocked but previously accepted deliveries may continue. Developer sees no API key menu and direct navigation must be rejected by backend and guarded by frontend.

### UI-07 event / UI-09 delivery terminology

- Event `ACCEPTED` is not a per-recipient delivery status.
- `SUCCEEDED` = transport 2xx; `FAILED` = terminal error or exhausted retry; `RETRY_WAIT` = next retry scheduled; `CANCELLED` = no further attempt; `IN_PROGRESS` = worker leased; `PENDING` = awaiting attempt.
- Event with zero delivery count shows **No matching subscriptions**, not “failed delivery”.
- Attempt timeline displays `generation`, `attempt_number`, started time, HTTP status (if any), safe error code and elapsed duration; an unknown attempt is not presented as a confirmed failure.
- Replay button available only on final `FAILED` and enabled endpoint, with permission; modal warns duplicates can occur and requires optional reason, then emits a unique `Idempotency-Key`. After `202`, navigate/refetch same delivery with incremented generation. For `409`, show state-changed explanation and refresh.

## 4. Wireframes (desktop-first; responsive single-column layout)

### 4.1 Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│ FlowUp | Overview  Applications  Endpoints  Events  Deliveries ... │
├────────────────────────────────────────────────────────────────────┤
│ Organization: Acme Dev                        Last 24h [▾] Refresh │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │Accepted     │ │Succeeded    │ │Failed final │ │Pending      │    │
│ │events       │ │deliveries   │ │deliveries   │ │deliveries   │    │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│ Recent delivery failures                  View all failures →       │
│ [status] [event] [endpoint] [last error] [time]                     │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Endpoint configuration

```text
┌───────────────────────────────────────────────────────────┐
│ Endpoints / Create endpoint                                │
│ Application*      [Customer Alpha                  ▾]     │
│ Name*             [ERP webhook                      ]     │
│ HTTPS URL*        [https://erp.example.com/webhook   ]     │
│ Subscribed events [order.created ×] [invoice.paid ×]       │
│ [Cancel]                                        [Create]    │
└───────────────────────────────────────────────────────────┘
┌──── On first creation only ────────────────────────────────┐
│ Signing secret: [••••••••••••] [Reveal] [Copy]             │
│ □ I have stored this secret securely                      │
│                                              [Done]        │
└───────────────────────────────────────────────────────────┘
```

### 4.3 Delivery detail / recovery

```text
┌───────────────────────────────────────────────────────────┐
│ Delivery del_123          FAILED           [Replay]       │
│ Event evt_123   order.created   App: Customer Alpha       │
│ Target: https://erp.example.com/... (snapshot)            │
│ Generation: 0  Attempts: 5  Last error: http_503          │
│ Timeline                                                   │
│ #1 503   14:01  320ms | #2 timeout ... | #5 503 15:12    │
│ [Event details] [Copy delivery ID]                         │
└───────────────────────────────────────────────────────────┘
```

## 5. UX behavior, accessibility and security

- Forms: React Hook Form optional; validate with Zod aligned to OpenAPI; mark required fields, focus first invalid field, preserve non-secret form data when request fails.
- TanStack Query: keys include resource and selected filters, invalidate list + detail on successful mutation; 401 clears user-facing authenticated data and redirects to sign-in; 403 shows access denied, not retry loop.
- Axios: use shared client with credentials/csrf only for management; **never put producer API keys in browser requests**. Producer publish examples shown as documentation only.
- Pagination: `next_cursor`; filter changes reset cursor; use accessible Previous/Next controls. Do not infer total counts from a page.
- Confirm destructive/irreversible mutations (disable, revoke, rotate, replay). Action feedback must come from API response; no optimistic “sent successfully” on replay.
- Accessibility: keyboard navigation, visible focus, labels and aria descriptions, non-color status text, WCAG AA contrast target, responsive tables with horizontal scrolling.
- Secrets/payload: sensitive event payload displayed only with role authorization; avoid browser analytics, clipboard auto-copy, and client-side persistence. HTML-escape all user-controlled strings. No raw endpoint response body surfaced.

## 6. UI acceptance criteria

| ID | Scenario | Expected outcome | Test mapping |
|---|---|---|---|
| UX-AC-01 | New admin creates application + endpoint | Resource created, single-view signing secret modal | FE-03, FE-04, QA-UI-02 |
| UX-AC-02 | Refresh secret page | Raw secret unavailable | FE-04, QA-SEC-07 |
| UX-AC-03 | Developer opens `/api-keys` | UI guard and server 403, no key metadata | FE-02, QA-AUTH-05 |
| UX-AC-04 | Publish accepted but no subscriptions | Event shows accepted / no subscribers; no invented delivery | FE-06, QA-E2E-03 |
| UX-AC-05 | A success, B final failure | Separate statuses and attempts shown | FE-07, QA-E2E-04 |
| UX-AC-06 | Failed delivery replayed | Warning, `202`, preserved history and new generation | FE-08, QA-E2E-07 |
| UX-AC-07 | Replay raced with worker or duplicate click | Show `409` or idempotent prior generation; no fake success | FE-08, QA-CON-06 |
| UX-AC-08 | Endpoint disable | Explicit pending/in-flight warning; statuses refreshed | FE-04, QA-E2E-09 |
| UX-AC-09 | Pagination/filter | Cursor and active filters remain consistent | FE-06, FE-07, QA-UI-08 |
| UX-AC-10 | Rate limit/error/session expiry | Correct error message and safe recovery action | FE-01, QA-UI-05 |

## 7. Dependencies and unresolved decisions

1. **Human authentication contract is incomplete in Phase 2**: define sign-in, sign-out, invite acceptance, session refresh and CSRF protocol before FE-02. UI-01 remains an explicit blocker until it exists.
2. Endpoint secret rotation: choose immediate cutover vs overlap grace, including pending deliveries; must update Phase 2 contract before implementation.
3. Application disable semantics for pending deliveries need final operational decision.
4. UI/API alignment: enforce consistent default sorting and date range semantics for `/usage/summary`, events and deliveries.
5. All changes to API response models require updating OpenAPI and contract fixtures, not silently guessing fields in frontend.
