# FlowUp — Test Plan & Acceptance v0.1

**Status:** Draft QA gate | **Phase:** 3 | **Sources:** URD, PRD, System Architecture, Database, API, Technical, UI/UX Specification.  
**Primary risk:** silently losing accepted events or sending tenant/customer data to an unauthorized endpoint.

## 1. Scope and quality strategy

- **Unit:** authorization policies, idempotency fingerprinting, event type/payload validators, HMAC, retry classification/backoff, delivery state transitions, URL policy.
- **Integration:** NestJS + actual PostgreSQL/Prisma, Redis/BullMQ, transaction/outbox, concurrent workers, endpoint snapshot, migrations.
- **Contract:** OpenAPI-driven producer/management request/response/error schemas, independent consumer raw-body signature verifier.
- **E2E:** React dashboard + API + dispatcher + worker + deterministic fake public HTTPS receivers. Use test-controlled DNS/egress fixture for SSRF; never depend on hitting real internal IPs.
- **Resilience/security:** fault injection (Redis down, DB failure, worker crash, network timeout), tenant isolation, XSS/CSRF/session, SSRF/DNS rebinding simulation.
- **Performance smoke:** representative publish and delivery loads; targets provisional until real pilot budgets are defined.

## 2. Test environment and data

Components: isolated ephemeral PostgreSQL, Redis, backend API, dispatcher, worker, React UI, two HTTP receiver simulators supporting 2xx, 4xx, 429, 5xx, delayed/hung response and disconnect. Signatures verified from raw received request body. Use network controls to simulate DNS responses without permitting production worker access to internal networks.

Fixtures: Organization A (Admin, Developer, application A1 and A2), Organization B (Admin, application B1); API keys scoped to A1 or B1; active/disabled endpoints subscribed to known event types; secrets with known test vectors; PII-free payloads. Reset DB/Redis between test suites; ensure deterministic clock for retry schedule.

Do not store live customer payloads, plaintext production credentials or external tenant data in tests.

## 3. Acceptance suite — behavior and business requirements

| ID | Type | Scenario / steps | Expected assertion | Coverage |
|---|---|---|---|---|
| QA-E2E-01 | E2E | Admin creates app, endpoint and scoped key | Org-scoped resources persist; one-time credentials shown | UR-01..05, FR-KEY/APP/END |
| QA-E2E-02 | E2E | Publish valid event to two matching endpoints | `202` only after DB commit; 1 event, 2 deliveries, 2 initial outbox intents | FR-EVT-03/04, FR-DEL-01 |
| QA-E2E-03 | E2E | No matching endpoint | `202`, 0 deliveries, `no_matching_subscriptions` shown in UI | FR-EVT-07, UX-AC-04 |
| QA-E2E-04 | E2E | Endpoint A 204, B 503 then 200 | A SUCCEEDED once; B retry then SUCCEEDED; attempt timelines independent | FR-DEL-05/06, FR-RET-01 |
| QA-E2E-05 | E2E | Endpoint returns permanent 400 | Delivery FAILED without default retry | FR-RET-02 |
| QA-E2E-06 | E2E | Endpoint times out / 429 with retry bounds | `RETRY_WAIT`, persisted next due, backoff bounded, terminal on exhaustion | FR-RET-01/03/05 |
| QA-E2E-07 | E2E | Replay final failed delivery | `202`; generation increments; prior attempts immutable; new attempt sent | FR-REP-01/02, UX-AC-06 |
| QA-E2E-08 | E2E | Duplicate publish same idempotency key and body; then changed body | Same event ID and count; changed body `409` | FR-EVT-05/06 |
| QA-E2E-09 | E2E | Disable endpoint while unsent delivery pending | Pending canceled, no new attempt; already in-flight may finish | FR-END-06, UX-AC-08 |
| QA-E2E-10 | E2E | URL updated after publish | Old pending delivery uses snapshotted old URL, new delivery uses new URL; both revalidated at send | FR-END-*, edge case 6 |
| QA-E2E-11 | E2E | Revoke publisher API key | New publish `401/403`, already accepted deliveries proceed | FR-KEY-03/04 |
| QA-E2E-12 | E2E | Delivery history and paginated search | Correct tenant filter, no lost/duplicated results across cursor pages | FR-OBS-* |

## 4. Fault tolerance and concurrent execution

| ID | Failure injection | Expected behavior | Coverage |
|---|---|---|---|
| QA-RES-01 | Redis unavailable before API publish | DB commit and `202` still possible; outbox pending; eventually dispatched after recovery | NFR-01, BE-08 |
| QA-RES-02 | DB commit fails before acknowledgement | No `202`; retry allowed; no ghost accepted event | FR-EVT-08 |
| QA-RES-03 | Dispatcher crashes between queue enqueue and DB outbox acknowledgement | Redis may contain duplicate job; DB state gives at most one active claim/delivery obligation | BE-08, FR-RET-06 |
| QA-RES-04 | Worker crashes **after** consumer acknowledges but **before** DB status update | Lease recovery marks old attempt UNKNOWN, sends again where warranted; possible duplicate documented | NFR-03, BE-10 |
| QA-RES-05 | Redis loses enqueued jobs | DB reconciler recreates due work; event/delivery not lost | NFR-01, BE-08 |
| QA-RES-06 | Concurrent worker starts same job | Exactly one valid live DB lease; no overlapping active attempts from same generation | BE-09/10 |
| QA-CON-01 | 50 simultaneous identical producer retries | Single event per scope/key, stable response fingerprint | FR-EVT-05 |
| QA-CON-02 | Same key, different bodies concurrently | Exactly one accepted content, others `409`; no inconsistent event count | FR-EVT-06 |
| QA-CON-03 | Endpoint disabled during queue delay | No new send after disable transaction visible; pending canceled | FR-END-06 |
| QA-CON-04 | Replay called before final failure | `409`, no new generation | FR-REP-01/03 |
| QA-CON-05 | Replay same operation key from two browser submissions | One new generation; idempotent response or documented conflict | FR-REP-03 |
| QA-CON-06 | Replay races worker/reconciler | No parallel conflicting generations; coherent timeline | FR-REP-03, UX-AC-07 |

**Note:** At-least-once delivery intentionally permits duplicate consumer receipt. The guarantee is durable acceptance + recoverable attempt, **not** exactly-once downstream execution.

## 5. Security / tenant / signing test matrix

| ID | Scenario | Expected behavior |
|---|---|---|
| QA-AUTH-01 | Anonymous dashboard read | 401; no data exposed |
| QA-AUTH-02 | Org A requests Org B event, delivery or endpoint ID | 404/403 without resource existence leak; no mutations |
| QA-AUTH-03 | Key scoped to A1 publishes to A2 or B1 | 403, no DB persistence, no dispatch |
| QA-AUTH-04 | Revoked key / invalid key / expired session | Denied; protected data absent |
| QA-AUTH-05 | Developer manages API keys or membership | 403 server-side; UI nav hidden |
| QA-SEC-01 | `localhost`, RFC1918, loopback, link-local, reserved, cloud metadata address | Configuration and/or connection rejected; no outbound packet to target |
| QA-SEC-02 | Public hostname resolving to internal IP / rebinding between checks | Connection-time bound IP validation rejects; worker safe |
| QA-SEC-03 | HTTPS endpoint redirects to internal/private host | Redirect not followed |
| QA-SEC-04 | URL contains credentials, unsupported protocol, prohibited port | 422 validation; no endpoint enabled |
| QA-SEC-05 | HMAC raw-byte known test vector + timestamp | Independently computed signature matches; tampered body/timestamp fails |
| QA-SEC-06 | Endpoint secret rotated under chosen ADR policy | Only documented version valid; pending snapshot/version behavior verified |
| QA-SEC-07 | Raw API key and signing secret after first reveal | Absent from GET, logs, Redis, analytics, error bodies, web cache persistence |
| QA-SEC-08 | CSRF + XSS attempts and reflected payload content | Unsafe mutation rejected; user-supplied content escaped |
| QA-SEC-09 | Rate limit and >256KiB request (if pilot cap ratified) | `429`/`413`; no delivery created |
| QA-SEC-10 | Unauthorized replay or payload read | Denied; audit trail captures authorized actions only |

## 6. API, data integrity and UI checks

| ID | Check | Expectation |
|---|---|---|
| QA-API-01 | All routes vs OpenAPI contract | Schema, status, optional fields and error envelopes match |
| QA-API-02 | `202` publish response | Stable ID/count/no_matching_reason; never claims delivery completion |
| QA-API-03 | Cursor paging/filter | Stable deterministic `(created_at,id)` and next cursor |
| QA-API-04 | HMAC headers | Event ID, delivery ID, type, timestamp, signature, attempt and generation documented |
| QA-DB-01 | Unique `(event_id,endpoint_id)` | Cannot create duplicate initial delivery obligation |
| QA-DB-02 | Unique `(delivery_id,generation,attempt_number,kind)` outbox | Repeated scheduling cannot create conflicting intents |
| QA-DB-03 | Unique per-generation attempt number | Timeline immutable, no renumbering after replay |
| QA-DB-04 | FK organization consistency | No cross-tenant foreign keys or orphan records |
| QA-UI-01 | Loading/empty/error/unauthorized | Accessible and accurate states |
| QA-UI-02 | One-time secret modal | Secret removed on navigate/refresh; user must acknowledge saved |
| QA-UI-03 | Status labels | Text + icon, not color-only; pending != delivered |
| QA-UI-04 | Keyboard and mobile viewport | Forms/dialogs/table accessible and usable |
| QA-UI-05 | 401, 403, 409, 422, 429, 5xx | Correct useful recovery UX; no claim of success on errors |
| QA-UI-06 | Delivery detail attempts | Order consistent across generations; UNKNOWN properly described |
| QA-UI-07 | Delete/disable/rotate/replay confirmation | Warn irreversible/duplicate outcomes before action |
| QA-UI-08 | List filters, cursors and back navigation | Filters preserved and pagination reset on filter changes |

## 7. Performance and operations smoke tests

Pilot **proposed** load: 10 organizations, 1,000 active endpoints total, 100 events/minute burst, fan-out up to 10, typical payload 1–16KiB; measure p50/p95 publish latency, queue lag, due-delivery lag, attempt completion latency, DB/Redis size and worker throughput. These are trial conditions, not guaranteed SLA values. Confirm actual tenancy and throughput assumptions before publishing limits.

Alert candidates: outbox oldest pending age, retry wait age, dispatcher failures, worker lease expirations, 5xx delivery share, DB connection saturation, Redis memory/evictions. Test graceful worker shutdown and restoration from known backup. Test retention policy only after limits are approved in ADR-04.

## 8. Test traceability and exit criteria

| Requirement family | Primary test IDs |
|---|---|
| `FR-ORG`, `FR-KEY`, `FR-APP` | QA-E2E-01, QA-AUTH-01..05 |
| `FR-END` | QA-E2E-09/10, QA-SEC-01..07 |
| `FR-EVT` | QA-E2E-02/03/08, QA-CON-01/02, QA-RES-02 |
| `FR-DEL`, `FR-RET` | QA-E2E-04..06, QA-RES-01..06, QA-API-04 |
| `FR-OBS`, `FR-REP` | QA-E2E-07/12, QA-CON-04..06, QA-UI-05/06 |
| `FR-SEC`, `NFR` | QA-AUTH/SEC, QA-RES, performance smoke |

**Pilot go/no-go:** 100% pass critical authorization/isolation, SSRF, HMAC, durable acceptance, Redis outage recovery, idempotency and replay concurrency scenarios. No severity-1/2 open defects; all contract tests and applicable browser E2E pass. Document accepted noncritical issues and monitored thresholds. Do not present proposed performance numbers as achieved until measured.

## 9. Open QA blockers

- Auth invitation/session contract missing in current Phase 2; write API addendum + tests.
- Secret rotation, app disable semantics, retention and retry envelope are explicitly undecided; ratify ADRs before final acceptance.
- Must define safe test infrastructure for DNS rebinding and outbound block simulation; never use uncontrolled public endpoints to test private-network access.
- Actual test evidence (run IDs, commits, environment and measurements) belongs to release report, not this forward-looking plan.
