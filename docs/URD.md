# FlowUp — User Requirements Document (URD)

**Version:** 0.1  
**Status:** Draft for business review  
**Date:** 2026-10-11  
**Parent:** `PRODUCT_OVERVIEW.md`  
**Next:** `PRD.md`

## 1. Purpose

Define who needs FlowUp, the problems they need solved, how they use the product, and the measurable outcomes required. This document specifies user and business behavior without mandating framework, database, queue or UI implementation.

## 2. Context and Assumptions

FlowUp is an outbound webhook delivery service for a SaaS producer. The producer's developer manages the recipient boundary, destination URLs and subscriptions. A single accepted event targets a single logical application/recipient and can fan out to subscribed endpoints **within that application only**.

Assumptions for v0.1:
- Pilot organizations are invited/onboarded; consumer endpoints do not require a FlowUp login.
- Publish API requires producer credential and recipient authorization.
- JSON payloads are delivered without semantic transformation.
- Delayed asynchronous transport is acceptable; strict ordering and exactly-once are not promised.

## 3. Actors

| Actor | Description | Primary goals |
|---|---|---|
| Organization Owner/Admin | Owns workspace, credentials and destinations | Set up safely; retain control and visibility |
| Developer/Operator | Configures integration and investigates delivery failures | Publish/debug/replay efficiently |
| Event Producer | Customer backend, using machine credential | Publish safely with a stable contract |
| Endpoint Consumer | External integration that receives HTTP webhook | Verify signature, process event, avoid duplicates |
| FlowUp System | Automated delivery service | Accept, route, deliver, retry and record outcomes |

## 4. User Journeys

### UJ-01 — Onboard and configure integration

1. Admin gains workspace access.
2. Admin/developer creates scoped publishing credentials.
3. Developer creates an application representing a single logical recipient.
4. Developer adds an HTTPS endpoint and selects event types.
5. Developer sees configuration status and can disable the endpoint.

**Success:** A configured endpoint exists with an explicit allowed recipient and event subscription.

### UJ-02 — Publish and inspect event

1. Producer sends authorized event with recipient ID, type, body and idempotency key.
2. FlowUp acknowledges durable acceptance with event ID.
3. Developer can inspect matched endpoints and delivery progress.

**Success:** No event is silently acknowledged without a recoverable record.

### UJ-03 — Recover from endpoint failure

1. An endpoint times out or returns a retryable error.
2. FlowUp records the failure and schedules another attempt within policy limits.
3. Developer views error and attempt history.
4. If the delivery reaches final failure, developer can replay it.

**Success:** Troubleshooting history persists and replay does not erase the original failure.

### UJ-04 — Protect recipient data

1. Producer is authorized for application A but not application B.
2. It attempts to publish to B or to register an unsafe destination.
3. FlowUp rejects the operation; no delivery is made.

**Success:** No unauthorized recipient is exposed to event data.

## 5. User Requirements

| ID | Actor | Requirement | Priority |
|---|---|---|---|
| UR-01 | Admin | Access an isolated organization workspace | Must |
| UR-02 | Admin/Developer | Create, view and revoke producer API keys | Must |
| UR-03 | Developer | Register and manage logical recipient applications | Must |
| UR-04 | Developer | Register, disable and update HTTPS endpoints | Must |
| UR-05 | Developer | Select event types delivered to each endpoint | Must |
| UR-06 | Producer | Publish events to an authorized application through an API | Must |
| UR-07 | Producer | Retry publishing safely without accidentally creating duplicate accepted events | Must |
| UR-08 | Developer | Know which endpoints were selected and which have received an event | Must |
| UR-09 | Developer | Have transient delivery failures retried automatically within a documented policy | Must |
| UR-10 | Developer | Verify the origin and integrity of outbound webhook payloads via a signing mechanism | Must |
| UR-11 | Developer | Inspect each delivery attempt, its time, HTTP outcome and safe failure reason | Must |
| UR-12 | Developer | Manually replay eligible failed deliveries while preserving history | Must |
| UR-13 | Admin | Ensure tenant/application boundaries prevent unintended cross-customer delivery | Must |
| UR-14 | Admin | Control destination and payload risks, including unsafe addresses and sensitive logs | Must |
| UR-15 | Developer | See a basic usage and delivery summary for incident triage | Should |
| UR-16 | Admin | Control organization member access according to predefined roles | Should |

## 6. Business Rules

| ID | Rule |
|---|---|
| BR-01 | An organization owns its API keys, applications, endpoints, events and deliveries; resources are not visible across organizations. |
| BR-02 | An event must carry one explicitly authorized application/recipient identifier. No implicit broadcast across applications. |
| BR-03 | Only endpoints under the designated application and subscribed to the event type are eligible for delivery. |
| BR-04 | Each event-endpoint pair creates an independent delivery obligation; one failure does not prevent other deliveries. |
| BR-05 | Publish acknowledgement means durable acceptance, not recipient processing or delivery success. |
| BR-06 | Reuse of a publish idempotency key in the same scope with identical content returns the existing event; conflicting content is rejected. |
| BR-07 | HTTP 2xx denotes transport success only. Non-2xx and network errors are classified under a documented retry policy. |
| BR-08 | Retries are bounded; a delivery ultimately ends as succeeded or exhausted/failed. |
| BR-09 | Replays are explicit authorized actions, leave previous attempts intact and may produce duplicate consumer processing. |
| BR-10 | Endpoints must use permitted public HTTPS destinations; blocked private/local targets and unsafe redirects must not be contacted. |
| BR-11 | A receiving endpoint can authenticate a signature based on a protected endpoint secret; secret material is never displayed or logged in plaintext after creation. |
| BR-12 | Event payload may contain sensitive data; only authorized users can inspect it and retention is limited. |
| BR-13 | If no endpoint matches, accepted event remains visible with zero deliveries and a clear no-subscribers reason. |
| BR-14 | Delivery attempts and replay actions are attributable and traceable. |
| BR-15 | Disabling an endpoint prevents *new* sends to it; policy for already pending jobs must be explicit and consistent (v0.1: pending unsent deliveries are cancelled, in-flight requests may finish). |

## 7. Use Cases and Acceptance Criteria

### UC-01 — Manage workspace and credentials (UR-01, UR-02)

**Precondition:** Admin has workspace access.  
**Main flow:** Create publishing key with authorized applications; display key once; publish using it.  
**Exceptions:** Missing/expired/revoked key or unauthorized scope is rejected.  
**Acceptance:** An authorized key publishes to its allowed application; revoked or out-of-scope key never creates a delivery.

### UC-02 — Configure recipient and subscriptions (UR-03, UR-04, UR-05, UR-14)

**Precondition:** Developer is authorized to manage destinations.  
**Main flow:** Create application, register safe HTTPS endpoint, subscribe to event types, enable endpoint.  
**Exceptions:** Invalid URL, blocked IP/network destination, unsupported event type, duplicate endpoint configuration.  
**Acceptance:** Valid setup succeeds; unsafe URL is refused; an unsubscribed event never routes to that endpoint.

### UC-03 — Publish event safely (UR-06, UR-07, UR-08, UR-13)

**Precondition:** Publishing key and application are valid.  
**Main flow:** Publish JSON event with idempotency key; FlowUp records event and selected deliveries, returns accepted event ID.  
**Exceptions:** Invalid payload, unauthorized application, same key with conflicting event, internal failure before persistence.  
**Acceptance:** Retried identical publish returns the same event; mismatched publish returns a conflict; after acknowledgement, event is queryable and recoverable; wrong application is rejected.

### UC-04 — Deliver and retry (UR-08, UR-09, UR-10, UR-11)

**Precondition:** Accepted event has an eligible endpoint.  
**Main flow:** Deliver signed payload; record outcome; if transient failure, retry within policy.  
**Exceptions:** Timeout, 429, 5xx, permanent 4xx, DNS failure, worker interruption, duplicate processing.  
**Acceptance:** A 2xx delivery succeeds; a retryable failure records an attempt and retries; a permanent failure stops; an endpoint failure does not affect others; duplicate attempts use stable identifiers and signed content.

### UC-05 — Investigate and replay (UR-11, UR-12, UR-15)

**Precondition:** Developer has access to an event/delivery in its organization.  
**Main flow:** Filter deliveries, inspect failed attempts and replay a final failure.  
**Exceptions:** Unauthorized replay, unknown ID, replay while another active attempt exists, disabled endpoint.  
**Acceptance:** Only authorized replay proceeds, history is preserved, and the UI clearly distinguishes automatic retry from manual replay.

### UC-06 — Isolation and access control (UR-01, UR-13, UR-14, UR-16)

**Precondition:** At least two organizations and two applications exist.  
**Main flow:** Users and producers access their own permitted resources.  
**Exceptions:** Forged IDs, cross-tenant endpoint lookup, unsafe URL substitution.  
**Acceptance:** Cross-tenant reads/mutations and mis-scoped publishes are refused; no network request is made to disallowed destinations.

## 8. Non-Functional User Expectations

| ID | Expectation | MVP interpretation |
|---|---|---|
| NUR-01 | Reliability | After acceptance, delivery obligations remain recoverable across process restart and temporary queue outage |
| NUR-02 | Transparency | Every delivery has outcome, attempt history, timestamps and a readable error classification |
| NUR-03 | Security | Encrypted transport, protected credentials, tenant isolation and SSRF protection |
| NUR-04 | Performance | Publish should not wait for target endpoint; latency and throughput measurable during pilot |
| NUR-05 | Data lifecycle | Retention, deletion and payload visibility rules defined prior to pilot |
| NUR-06 | Operability | Operators can identify backlog and repeated endpoint failure without database access |
| NUR-07 | Predictability | Delivery guarantees, duplicate behavior and retry limits clearly documented |

**Numerical SLOs and limits** are proposed in PRD as pilot targets and refined after load testing.

## 9. Out-of-Scope User Requests

No native platform connectors, content mapping, workflow sequencing, broadcast across arbitrary tenants, AI suggestions, consumer-facing portal, custom enterprise RBAC, paid billing or guaranteed ordered delivery in v0.1.

## 10. Open Questions Requiring Stakeholder Validation

- Who in a pilot company will own endpoint setup and incident resolution?
- Is application-scoped fan-out sufficient for early integrations?
- Which payload retention period fits pilot privacy requirements?
- Is the primary buying reason reduced engineering maintenance, time-to-market or customer integration reliability?
- What manual fallback do pilot teams use when delivery fails?

## 11. Requirement Coverage

All `UR-*` items are mapped to implementable features and measurable acceptance tests in `PRD.md`. A feature not traceable to a user need must be explicitly justified before adding it to MVP scope.
