# FlowUp — Product Overview

**Version:** 0.1  
**Status:** Draft for review (business/product baseline)  
**Date:** 2026-10-11  
**Product category:** Outbound Webhook Delivery as a Service  
**Related documents:** `URD.md`, `PRD.md`

## 1. Executive Summary

FlowUp is a hosted service that enables SaaS teams and developers to publish business events once and deliver those events asynchronously to customer- or partner-configured HTTP endpoints. FlowUp manages destination registration, event subscriptions, secure signing, bounded retry, visibility into delivery attempts, and manual replay.

**Value proposition:** **Publish once. Deliver reliably. Debug easily.**

FlowUp is **not** a general automation platform, CRM, marketing platform, source connector, or business data transformation engine in v0.1.

## 2. Problem and Opportunity

A SaaS provider wishing to offer outbound webhooks typically needs to build and operate endpoint registration, routing, authentication/signing, retries, backoff, failure tracking, replay, and tenant isolation. Building these capabilities distracts from core product delivery and creates an operational burden.

FlowUp proposes to take on that delivery responsibility. This is a **product hypothesis**, not a validated claim that prospective customers will purchase FlowUp. Comparable products exist; customer interviews and paid pilots must validate differentiation.

### Target customer

- **Primary buyer:** Technical founder, backend lead, or engineering manager at a SaaS company offering webhook-based integrations.
- **Primary operator:** Developer or technical administrator configuring events/endpoints and debugging deliveries.
- **Indirect user:** External partner/customer operating a receiving endpoint. This party does **not** need a FlowUp account in v0.1.

### Example use case

A SaaS order-management provider publishes `order.created` for a specific logical recipient. FlowUp delivers it to that recipient's subscribed ERP endpoint, retries transient failures, and exposes attempt history to the provider's developers.

## 3. Jobs to Be Done

1. **When** my product produces a business event, **I want** to publish it once via an API **so that** the intended integrations receive it without synchronous coupling.
2. **When** an endpoint is temporarily unavailable, **I want** controlled retries **so that** recoverable interruptions do not require manual intervention.
3. **When** delivery fails, **I want** clear diagnostics and replay **so that** I can resolve incidents quickly.
4. **When** multiple customers subscribe to similar event types, **I want** explicit recipient scoping **so that** one customer's data is never sent to another.

## 4. Product Principles

- **Correct routing before convenience:** An event must target an authorized logical recipient; event type alone is insufficient for tenant-customer isolation.
- **Durable acceptance:** A successful publish acknowledgement means the event is persisted for later dispatch, not that delivery has completed.
- **At-least-once, not exactly-once:** Delivery duplication is possible; consumer idempotency is expected.
- **Inspectability:** Event, delivery, and attempt are distinct concepts with traceable history.
- **Secure by default:** Tenant isolation, HTTPS public destinations, URL/SSRF protections, signing, key management, retention/redaction.
- **Simple first:** Small modular monolith; no generic workflow builder or complex connector catalogue.

## 5. Vocabulary and Domain Model

| Term | Meaning |
|---|---|
| Organization / Tenant | SaaS customer of FlowUp; owns all resources and limits |
| Producer | Backend publishing an event using scoped credentials |
| Application / Recipient | Tenant-owned logical external customer or integration boundary used to scope routing; not necessarily an identified legal entity |
| Endpoint | Configured HTTPS destination URL belonging to one application |
| Subscription | Event types an endpoint agrees to receive |
| Event | Immutable accepted business message with type, recipient scope, payload, and provenance |
| Delivery | Obligation to send one event to one eligible endpoint |
| Attempt | A single HTTP delivery try and its observed outcome |
| Replay | Authorized creation/scheduling of another attempt or delivery for a previous failed delivery, preserving history |

## 6. End-to-End Business Flow

1. Organization administrator joins FlowUp and obtains access to a workspace.
2. Developer creates a publishing API key and a logical application/recipient.
3. Developer registers HTTPS endpoint(s) under that application and subscribes each endpoint to event type(s).
4. Producer sends an event specifying a recipient (`application_id`), event type and JSON payload with an idempotency key.
5. FlowUp validates credentials and scope, persists the event and the matched deliveries, and responds with an accepted event identifier.
6. Background delivery sends signed HTTP requests independently to each matching endpoint.
7. HTTP 2xx means transport acknowledgement; eligible temporary failures are retried with a bounded policy.
8. Developer views event/delivery/attempt status and can manually replay eligible failures.

**No matching endpoints:** The event is still accepted and recorded with zero deliveries, with the reason visible in the UI/API. It is **not** broadcast to other applications.

## 7. Scope

### In scope — v0.1

- Account access and single organization workspace per initial user; organization membership and access controls sized for MVP.
- Scoped producer API keys with rotation/revocation.
- Application (logical recipient) management.
- HTTPS endpoint CRUD and event-type subscriptions.
- Publishing JSON events with idempotency protection.
- Authorized routing and independent asynchronous webhook delivery.
- HMAC signing, timeout, bounded retry and final failure state.
- Event/delivery/attempt history, filtering and basic counters.
- Manual replay of failed deliveries with permission checks and audit trail.
- Basic operational and security protections (limits, SSRF defense, retention, isolation).

### Explicitly out of scope — v0.1

- Native Shopify/Stripe/CRM inbound connectors and payload transformations.
- Visual automation/workflow builder, multi-step orchestration.
- SMS/email/push delivery channels, guaranteed ordering and exactly-once processing.
- Customer-facing embedded portal, custom RBAC designer, enterprise SSO.
- Paid subscriptions/billing, marketplace, AI analytics.
- Multi-region HA and contractual enterprise SLA.

## 8. Proposed First-Release Packaging

FlowUp initially serves an invited pilot cohort. Public self-service signup and billing are deferred until reliability, abuse protection, pricing and support capacity are validated. Endpoint consumers remain external to the product and do not register.

## 9. Product Success and Guardrails

### Pilot outcome measures (targets to validate, not market facts)

- A pilot producer can publish an event and identify delivered/failed outcomes in the dashboard without FlowUp staff assistance.
- At least two independent endpoints can receive the same event when intentionally configured under the same application.
- A temporarily unavailable endpoint succeeds after a retry in a controlled integration test; another endpoint is unaffected.
- A user can determine the last failure reason and replay a failed delivery.
- Zero observed cross-tenant or cross-application unauthorized deliveries in security tests.

### Metrics to instrument

- Accepted events, created deliveries, attempts, success/final-failure counts.
- Delivery latency p50/p95/p99 from acceptance to successful delivery.
- Retry rate, replay rate, time-to-diagnosis, and queue backlog.
- API publish errors, auth failures, endpoint timeout rate.
- Trial activation, pilot retention and willingness to pay (collected explicitly).

**Avoid** presenting delivery rate alone as user value; measure time saved and integration reliability during pilots.

## 10. Major Risks and Unknowns

| Risk | Mitigation / validation |
|---|---|
| Strong incumbents | Interview SaaS teams about current tooling and purchase decision; find specific unmet job |
| No clear willing buyer | Pilot invitation with explicit willingness-to-pay question before wider build |
| Misrouting sensitive events | Recipient scoping plus tenant-level authorization tests |
| Duplicate delivery | Document at-least-once semantics; stable event/delivery IDs; consumer guidance |
| Malicious endpoint URL (SSRF) | Restrict schemes, resolve and check IPs at connection, block redirects and private addresses |
| Reliability across DB + queue | Durable source of truth and recoverable dispatch; detail reserved for architecture |
| Variable payload sensitivity | Payload size caps, retention, secret redaction, minimal logs |

## 11. Key Decisions and Open Questions

### Decisions for v0.1

- Outbound-only HTTP(S) webhooks, with one event targeted to **one logical application/recipient** at publish time.
- Multiple endpoints per application may match the event type.
- API key belongs to organization and is constrained by allowed applications.
- Producer-managed endpoint configuration; consumer self-service portal excluded.
- Treat HTTP 2xx as transport-level success only.
- PostgreSQL is the durable source of business truth. Internal queue/worker details belong in architecture.

### Open questions for pilot validation

1. Do pilot customers primarily require per-customer application routing or broadcast topics across internal destinations? (v0.1 picks application-scoped routing.)
2. What default retention, payload size limit, delivery timeout and retry window best match pilot workloads?
3. Which pricing unit matters most: events, attempts/deliveries, endpoints or applications?
4. What permission split is necessary between organization admin and developer in early pilots?

## 12. Traceability

- Product scope is decomposed into `URD.md` user requirements (`UR-*`) and `PRD.md` product features (`FR-*`).
- Implementation/design documents must reference `FR-*` and acceptance tests before introducing new MVP scope.
