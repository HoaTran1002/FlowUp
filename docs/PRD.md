# FlowUp — Product Requirements Document (PRD)

**Version:** 0.1  
**Status:** Draft for product/engineering review  
**Date:** 2026-10-11  
**Depends on:** `PRODUCT_OVERVIEW.md`, `URD.md`  
**Scope:** Invite-only v0.1 pilot; outbound HTTPS webhooks

## 1. Objective and Release Definition

**Objective:** A developer at a SaaS organization can securely configure a recipient application and endpoints, publish a JSON event, observe independent signed deliveries, recover from transient failure, and replay final failures without operator intervention.

**Release success scenario:** Admin creates workspace credentials; developer registers application `app_001`, two endpoints subscribed to `order.created`; producer publishes one event; endpoint A succeeds, endpoint B fails then succeeds after retry; developer sees one event, two deliveries and all attempts. A publish retry with the same idempotency key does not create duplicates. Unauthorized application routing is refused.

## 2. Personas and Main User Stories

- **Organization Admin:** As an admin, I can manage publishing credentials and restrict applications, so only my systems can send authorized events.
- **Integration Developer:** As a developer, I can configure recipients, subscriptions and signing so integrations work without a custom delivery service.
- **Support/Operator:** As an operator, I can identify when and why a delivery failed and replay it, so incidents can be resolved quickly.
- **Producer Backend:** As a backend, I can send one durable event and immediately receive an identifier, so my customer-facing request is not blocked by downstream endpoints.
- **Consumer Backend:** As a consumer, I can verify authenticity and de-duplicate by event/delivery identity.

## 3. Features and Functional Requirements

### F01 — Organization Access & Roles

**Mapped UR:** UR-01, UR-13, UR-16  
**Priority:** P0 for basic access/isolation; P1 for additional members.

| ID | Requirement |
|---|---|
| FR-ORG-01 | Invite-only onboarding produces an isolated organization workspace. |
| FR-ORG-02 | Authenticated users can access only organizations they belong to. |
| FR-ORG-03 | MVP role presets: Admin and Developer; Admin controls credentials and memberships, Developer can manage integrations, inspect and replay. |
| FR-ORG-04 | Mutating operations record actor ID and organization ID for auditability. |

**Acceptance:** Org A user cannot read/change Org B's endpoints/events, even by guessing IDs. Developer cannot perform admin-only operations.

### F02 — Producer Credentials

**Mapped UR:** UR-02, UR-13, UR-14  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-KEY-01 | Admin can create a machine publishing key with a name and allowlist of application IDs. |
| FR-KEY-02 | Raw key is shown once; only verifier/hash or suitably protected representation is retained. |
| FR-KEY-03 | Admin can revoke a key and see creation date, last-used time and status. |
| FR-KEY-04 | Invalid, revoked or application-out-of-scope credentials are rejected before persistence. |

**Acceptance:** A key authorized for app A cannot publish to app B; revoked key cannot publish; full key value is never returned in list responses.

### F03 — Applications / Logical Recipients

**Mapped UR:** UR-03, UR-13  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-APP-01 | Create, list, edit display name, disable and inspect applications scoped to one organization. |
| FR-APP-02 | Application ID acts as recipient boundary, independent of human/legal customer identity. |
| FR-APP-03 | Events may target only active applications owned by the authenticated organization and allowed by the producer credential. |

**Acceptance:** App selection is mandatory; no cross-application fan-out occurs.

### F04 — Endpoints & Event Subscriptions

**Mapped UR:** UR-04, UR-05, UR-10, UR-14  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-END-01 | Authorized user may create/list/update/disable an endpoint under a specific application. |
| FR-END-02 | Endpoint requires valid public HTTPS URL and explicit list of subscribed event type strings. |
| FR-END-03 | Endpoint secret is generated/provisioned securely and exposed only during initial setup or rotation. |
| FR-END-04 | Endpoints can rotate signing secret with a defined migration/grace policy; pilot may use immediate rotation if documented. |
| FR-END-05 | New events route only to enabled endpoints that match application and event type. |
| FR-END-06 | When disabled, no new attempts are scheduled for that endpoint; unsent pending deliveries are cancelled, but already in-flight HTTP calls may finish. |

**Acceptance:** Publishing `order.created` for app A generates no delivery to app B or to an endpoint only subscribed to `invoice.paid`. Unsafe addresses are rejected before sending.

### F05 — Event Publishing & Idempotency

**Mapped UR:** UR-06, UR-07, UR-08, UR-13  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-EVT-01 | Expose authorized API to publish event with `application_id`, `type`, JSON `data`, and `Idempotency-Key` header. |
| FR-EVT-02 | Validate types, payload size, target application, quota, and key scope. |
| FR-EVT-03 | Persist immutable event record and eligible delivery obligations before acknowledging acceptance. |
| FR-EVT-04 | Return `202 Accepted` with stable event ID and initial delivery count; does not claim downstream success. |
| FR-EVT-05 | Idempotency scope is organization + producer key identity + idempotency key; same request fingerprint returns existing accepted event. |
| FR-EVT-06 | Same idempotency key and differing normalized request content returns `409 Conflict`. |
| FR-EVT-07 | No matching endpoint results in accepted event with zero deliveries and explicit `no_matching_subscriptions` detail. |
| FR-EVT-08 | Publish before durable commit must fail without returning acceptance; a subsequent safe retry must be supported. |

**Acceptance:** Two concurrent equal publishes with one key produce exactly one accepted event record and its deliveries; conflicting payload is rejected. If delivery service is unavailable, accepted data remains recoverable.

### F06 — Routing & Signed Delivery

**Mapped UR:** UR-08, UR-10, UR-13  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-DEL-01 | An event creates at most one initial delivery per matched endpoint. |
| FR-DEL-02 | Delivery worker performs HTTP POST to saved endpoint URL with JSON event envelope, event ID, delivery ID, timestamp and signature headers. |
| FR-DEL-03 | HMAC-SHA256 signs a documented canonical string over timestamp and exact raw request body using endpoint-specific secret. |
| FR-DEL-04 | Worker enforces outbound timeout, safe redirect policy and connection-time destination IP validation. |
| FR-DEL-05 | A 2xx HTTP response marks transport delivery successful, independent of receiving business processing. |
| FR-DEL-06 | Results of different endpoint deliveries for the same event remain independent. |

**Acceptance:** Two subscriptions yield two HTTP requests, each correctly signed. A failure at B does not modify the successful state at A. Consumer signature verification sample passes.

### F07 — Retry & Recovery

**Mapped UR:** UR-09, UR-11  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-RET-01 | Timeout, transient network errors, 429 and 5xx are retryable within configured bounds. |
| FR-RET-02 | Most other 4xx are terminal by default; exceptions and policy must be documented. |
| FR-RET-03 | Apply exponential backoff plus jitter, with max attempt count and max retry age. |
| FR-RET-04 | Persist each attempt outcome; recover unsent/in-progress claims after crash or temporary queue outage. |
| FR-RET-05 | A delivery reaches final `FAILED` when retry is exhausted or error is permanent, and may be manually replayed. |
| FR-RET-06 | Duplicate execution cannot create unauthorized deliveries or erase attempt history; downstream duplicate processing remains possible. |

**Pilot defaults (proposals requiring testing):** 5 total automatic attempts; base delay 5s with jitter; 10s per-request timeout; max retry window 24h. Final configuration must be a single documented policy and cannot rely solely on queue-local state.

**Acceptance:** Simulated 503 succeeds after recovery; repeated 400 ends without automatic retry; worker crash and queue outage do not strand an accepted event permanently.

### F08 — Delivery History, Search and Detail

**Mapped UR:** UR-08, UR-11, UR-15  
**Priority:** P0 basic; P1 dashboard aggregates.

| ID | Requirement |
|---|---|
| FR-OBS-01 | List accepted events by time/type/application and show matched delivery count. |
| FR-OBS-02 | Filter deliveries by application, endpoint, status, event and date. |
| FR-OBS-03 | Detail page shows event/delivery identifiers, current status and immutable per-attempt timeline. |
| FR-OBS-04 | Attempt details include timestamp, duration, safe HTTP status/error category and next retry time when relevant. |
| FR-OBS-05 | Mask credentials/authorization and avoid logging sensitive response bodies or arbitrary full payloads. |
| FR-OBS-06 | Provide basic counts of received events, successful deliveries, final failures and pending retries. |

**Acceptance:** Developer can diagnose the most recent failure and find its attempt history without direct database access; access is tenant-scoped.

### F09 — Manual Replay

**Mapped UR:** UR-12, UR-13  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-REP-01 | Authorized developer/admin can replay a final failed delivery while endpoint is enabled and safe. |
| FR-REP-02 | Replay creates an auditable new execution generation/attempt and does not delete old outcomes. |
| FR-REP-03 | Replays are protected against duplicate clicks and conflicting active deliveries. |
| FR-REP-04 | UI/API explains that replay can reprocess the webhook at the consumer. |

**Acceptance:** A failed delivery can be retried manually, old attempts remain visible, two simultaneous replay commands do not schedule uncontrolled duplicate work.

### F10 — Security, Governance and Limits

**Mapped UR:** UR-13, UR-14  
**Priority:** P0

| ID | Requirement |
|---|---|
| FR-SEC-01 | Enforce tenant/application checks on every API read, write and worker operation. |
| FR-SEC-02 | Restrict outbound calls to HTTPS public IP destinations, reject loopback/link-local/private/reserved ranges and unsafe redirects; re-check resolution at connection. |
| FR-SEC-03 | Apply publish rate limits and payload size caps per organization/credential. |
| FR-SEC-04 | Protect secrets at rest and in transit; enable rotation/revocation. |
| FR-SEC-05 | Define configurable operational retention and deletion rules for payloads and attempt metadata before public use. |
| FR-SEC-06 | Create audit records for key, endpoint, permission and replay mutations. |

**Acceptance:** SSRF scenarios, DNS rebinding attempts, cross-tenant access and key leakage checks fail closed; application still delivers to valid public HTTPS test destinations.

## 4. User Interface Specification (Product Level)

| Page | Primary actions | Required states |
|---|---|---|
| Sign in / Workspace | Authenticate and select authorized workspace | Loading, unauthorized, success |
| Applications | Create, edit, disable application | Empty, populated, validation error |
| Endpoints | Create/edit/disable URL; subscribe types; configure secret | No endpoints, active, disabled, invalid/unsafe URL |
| API Keys | Create scoped key, copy once, revoke | Empty, active, revoked |
| Events | Filter/list events and show no-subscriber outcomes | Empty, loaded, error |
| Deliveries | Filter by status/endpoint/type and navigate details | Pending, sending, retrying, success, final failure |
| Delivery Detail | Inspect timeline, safe errors and replay | Replay allowed, forbidden, disabled endpoint, active retry |
| Overview | Basic event/delivery counts | No data, selected time range |

Accessibility: keyboard usable controls, labeled errors, visible loading/retry affordances, no status conveyed by color alone.

## 5. API Behavior Contracts (Product Level)

> Paths below are proposed route names, not final OpenAPI schemas. Full models and validation will be specified in the later API Specification.

| Operation | Candidate route | Outcome |
|---|---|---|
| Publish event | `POST /v1/events` | 202; event ID and initial delivery count |
| Create/list applications | `POST/GET /v1/applications` | Tenant-scoped |
| Create/list endpoints | `POST/GET /v1/endpoints` | Tenant + application-scoped |
| Update/disable endpoint | `PATCH /v1/endpoints/{id}` | Validated and audited |
| Manage API keys | `/v1/api-keys` | Admin-only create/revoke |
| List/find events | `GET /v1/events`, `GET /v1/events/{id}` | Tenant-scoped |
| List delivery attempts | `GET /v1/deliveries/{id}/attempts` | Tenant-scoped |
| Replay delivery | `POST /v1/deliveries/{id}/replay` | Audited and conflict-safe |

**Sample publish request**

```http
POST /v1/events
Authorization: Bearer flw_live_REDACTED
Idempotency-Key: order-123-created
Content-Type: application/json
```

```json
{
  "application_id": "app_001",
  "type": "order.created",
  "data": { "order_id": "ORD-123", "amount": 1500000 }
}
```

**Example accepted response**

```json
{
  "id": "evt_001",
  "status": "accepted",
  "delivery_count": 2
}
```

## 6. Status Definitions and Edge Cases

### Event

- `ACCEPTED`: durable publish stored; may have zero or multiple deliveries.
- Event lifecycle does **not** collapse independent delivery results into a single boolean.

### Delivery

- `PENDING` → `IN_PROGRESS` → `SUCCEEDED`.
- `IN_PROGRESS` → `RETRY_WAIT` → `IN_PROGRESS` on eligible failure.
- `IN_PROGRESS` → `FAILED` on permanent failure or exhausted attempts.
- `PENDING`/`RETRY_WAIT` → `CANCELLED` if target disabled before send.
- Manual replay of `FAILED` creates a new execution generation with separate traceable attempts.

### Important edge cases

1. An application has no matching enabled endpoints: accepted event, zero deliveries.
2. Endpoint A succeeds and B fails: A remains succeeded, B retries.
3. Producer retries same idempotency key after timeout: existing event returned if committed.
4. Worker sends successfully but crashes before recording response: retry may duplicate delivery; consumer uses stable IDs.
5. Endpoint is disabled between enqueue and attempt: unsent attempt is cancelled.
6. Endpoint URL changes after event acceptance: v0.1 delivery target is snapshotted at delivery creation; no silent retroactive rerouting. Security checks still run at send time.
7. Endpoint DNS resolves to prohibited destination: reject delivery without sending.
8. Replay while retry is active: return conflict or disabled action.
9. Response body contains credentials/PII: do not store full arbitrary body.
10. Key revoked while an accepted event is pending: already accepted deliveries remain valid; revocation blocks *new publishes*.

## 7. MVP Non-Functional Requirements

| ID | Requirement | Pilot acceptance approach |
|---|---|---|
| NFR-01 | Durable acceptance and recoverable dispatch | Crash/queue outage test after publish success |
| NFR-02 | Tenant and application isolation | Automated authorization + adversarial routing tests |
| NFR-03 | At-least-once delivery with documented duplicate risk | Crash-at-ack test and consumer dedup demo |
| NFR-04 | Predictable attempts and retry policy | 429/5xx/400/timeout matrix tests |
| NFR-05 | Safe HTTPS egress | Private IP, redirect, DNS rebinding tests |
| NFR-06 | Published envelope and HMAC verifier sample | Cross-language or independent verification tests |
| NFR-07 | Bounded resource usage | Configurable request body size, timeout, rate limits and worker concurrency |
| NFR-08 | Operational visibility | Backlog/failed-count metrics plus structured, redacted logs |
| NFR-09 | Recoverable retention lifecycle | Payload expiration does not corrupt metadata and audit boundaries |
| NFR-10 | Performance instrumentation | Collect p50/p95 acceptance latency and time-to-delivery under agreed pilot workload; set SLO after measurement |

Proposed pre-pilot limits (subject to load/security review): 256 KiB JSON payload, 10-second endpoint request timeout, 5 automatic attempts, 24-hour retry horizon, and a 30-day event/attempt retention baseline. Never claim these are contractual SLAs.

## 8. Release Acceptance — Critical End-to-End Tests

| Test ID | Links | Given / When / Then |
|---|---|---|
| AT-01 | UR-03–06, FR-APP, FR-END, FR-EVT | Given app A with two subscribed endpoints, when one event is published, then two independent deliveries are created. |
| AT-02 | UR-07, FR-EVT | Given identical simultaneous publishes with same idempotency key, then exactly one accepted event exists. |
| AT-03 | UR-07, FR-EVT | Given reused key and changed content, then API returns conflict and creates no new event. |
| AT-04 | UR-08–09, FR-DEL, FR-RET | Given one endpoint returns 503 and another 200, then only the failed delivery retries. |
| AT-05 | UR-09, FR-RET | Given permanent 400, then no automatic retry is scheduled. |
| AT-06 | UR-10, FR-DEL | Given signed delivery, then consumer verifier validates exact body and timestamp. |
| AT-07 | UR-11–12, FR-OBS, FR-REP | Given final failure, when developer replays, then new attempts appear without overwriting history. |
| AT-08 | UR-13, FR-SEC | Given key scoped app A, when publishing to B, then denied and no delivery created. |
| AT-09 | UR-14, FR-SEC | Given localhost/private network/unsafe DNS URL, when attempting delivery, then request blocked. |
| AT-10 | UR-06, NFR-01 | Given event committed and queue unavailable, when dispatcher recovers, then its deliveries are eventually scheduled. |
| AT-11 | UR-08, FR-END | Given endpoint disabled before first send, when worker processes job, then delivery is cancelled without HTTP request. |
| AT-12 | UR-11, FR-OBS | Given failure, when viewing detail, then safe status/error and per-attempt timing are visible. |

## 9. Scope Prioritization

### P0 / pilot must-have

Organization authentication and isolation; scoped API keys; applications; endpoint management/subscriptions; publish API; durable acceptance; routing; signed delivery; retry/recovery; logs/attempts; replay; egress security.

### P1 / only if P0 stable

Extended dashboard aggregations, member invitations beyond initial admin/developer setup, custom endpoint retry configuration, better operational filters, sample SDK.

### Post-MVP

Billing, public signup at scale, consumer portal, native inbound connectors, complex filtering/transformations, advanced workflow orchestration, enterprise SSO, multi-region deployment, AI.

## 10. Risks, Dependencies, Open Decisions

- **Commercial:** Need user interviews and pilot acceptance; no verified willingness to pay yet.
- **Authentication:** Choose pilot login/provider and member onboarding before build.
- **Transport:** Document exact canonical signing envelope and clock-skew window in API design.
- **Routing:** Application-bound fan-out is selected for v0.1; do not introduce global topics accidentally.
- **Endpoint lifecycle:** Snapshot endpoint URL and subscription eligibility at event acceptance; secrets rotate with an explicit verification policy.
- **Retries:** Choose final attempt schedule, terminal codes, 429 retry-after treatment and replay semantics in technical design.
- **Durability:** Ensure DB/queue consistency and stalled job recovery in system architecture.
- **Retention:** Confirm pilot data protection requirements and regional hosting choice.
- **Quotas:** Set realistic plan-specific limits from tests, not from guesswork.

## 11. Traceability Matrix

| URD requirements | PRD modules | Acceptance tests |
|---|---|---|
| UR-01, UR-16 | F01 | AT-08 plus RBAC tests |
| UR-02 | F02 | AT-08 plus revoked key test |
| UR-03–05 | F03, F04 | AT-01, AT-11 |
| UR-06–07 | F05 | AT-01, AT-02, AT-03, AT-10 |
| UR-08–10 | F06, F07 | AT-04, AT-05, AT-06 |
| UR-11–12 | F08, F09 | AT-07, AT-12 |
| UR-13–14 | F01, F02, F03, F10 | AT-08, AT-09 |
| UR-15 | F08 | AT-12 plus dashboard counts |

## 12. Product Sign-Off Checklist

- [ ] Target pilot persona and use case confirmed.
- [ ] Tenant/recipient isolation semantics agreed.
- [ ] No-match and disabled-endpoint behavior approved.
- [ ] Retry and replay guarantees understood (at-least-once).
- [ ] Security, retention and data access policy reviewed.
- [ ] API contract and numerical limits ready to formalize in technical documents.
- [ ] Commercial validation plan and user success criteria agreed.

**Next documents:** System Architecture → Database Design → API Specification → Technical Design → UI/UX Specification → Implementation Plan → Test Plan. These must follow PRD IDs and avoid expanding MVP scope without explicit approval.
