# FlowUp — REST API Specification v0.1

**Status:** Proposed public contract. **Base:** `/v1`; JSON UTF-8; RFC3339 UTC timestamps; opaque IDs.  
**Inputs:** `PRD.md` (`FR-*`, `AT-*`), `SYSTEM_ARCHITECTURE.md`, `DATABASE_DESIGN.md`.

## 1. API audiences and authentication

| Surface | Credentials | Scope |
|---|---|---|
| Producer API `POST /v1/events` | `Authorization: Bearer flw_...` machine publishing key | organization and allowlisted application IDs |
| Dashboard management API | authenticated human session (Secure, HttpOnly, SameSite cookie + CSRF protection, or a documented equivalent) | organization membership role: Admin/Developer |
| Outbound webhook | HMAC signature headers, verified by consumer | endpoint-specific secret version |

No API uses caller-provided `organization_id` for authorization; derive tenant from authenticated identity. Human admin-only: create/revoke API keys and membership changes. Developer: manage applications/endpoints, read data, replay.

HTTP status conventions: `200` read/update, `201` new resource, `202` durable accepted event or replay scheduled, `204` revoke/disable where response-free, `400` malformed, `401` unauthenticated, `403` unauthorized, `404` absent/not-owned (avoid cross-tenant existence leak), `409` conflict, `413` too large, `422` semantic validation, `429` rate limit, `5xx` transient failure.

Common error envelope:

```json
{"error":{"code":"idempotency_conflict","message":"Idempotency key used with different content","request_id":"req_...","details":{}}}
```

No secrets, full payloads or raw downstream responses in error messages. All list routes use cursor pagination `?limit=20&cursor=...`; default 20 max 100, deterministic `(created_at,id)` ordering, response `{ "data":[], "next_cursor":null }`. Filters scoped to authenticated tenant.

## 2. API contract table

| Method / route | Role | Requirement | Response |
|---|---|---|---|
| `POST /v1/events` | Producer | `FR-EVT-*` | `202` accepted |
| `GET /v1/events` | Dashboard | `FR-OBS-01` | `200` paginated |
| `GET /v1/events/{eventId}` | Dashboard | `FR-OBS-01` | `200` detail |
| `POST /v1/applications` | Admin/Developer | `FR-APP-01` | `201` |
| `GET /v1/applications` | Admin/Developer | `FR-APP-01` | `200` |
| `PATCH /v1/applications/{id}` | Admin/Developer | `FR-APP-01` | `200` |
| `POST /v1/endpoints` | Admin/Developer | `FR-END-01/02/03` | `201` + secret shown once |
| `GET /v1/endpoints` | Admin/Developer | `FR-END-01` | `200` |
| `PATCH /v1/endpoints/{id}` | Admin/Developer | `FR-END-01/06` | `200` |
| `POST /v1/endpoints/{id}/rotate-secret` | Admin/Developer | `FR-END-04` | `201` secret shown once |
| `POST /v1/api-keys` | Admin | `FR-KEY-01/02` | `201` raw key shown once |
| `GET /v1/api-keys` | Admin | `FR-KEY-03` | `200` metadata only |
| `POST /v1/api-keys/{id}/revoke` | Admin | `FR-KEY-03` | `200` status |
| `GET /v1/deliveries` | Admin/Developer | `FR-OBS-02` | `200` list |
| `GET /v1/deliveries/{id}` | Admin/Developer | `FR-OBS-03` | `200` detail |
| `GET /v1/deliveries/{id}/attempts` | Admin/Developer | `FR-OBS-04` | `200` timeline |
| `POST /v1/deliveries/{id}/replay` | Admin/Developer | `FR-REP-*` | `202` or `409` |
| `GET /v1/usage/summary` | Admin/Developer | `FR-OBS-06` | `200` basic counts |

Auth bootstrap/invitation/session endpoints require implementation detail prior to opening pilot; **do not** treat them as public producer API. Initial MVP may onboard first organization/admin through an operator-managed invitation while still providing secure dashboard login.

## 3. Publish event — primary public API

`POST /v1/events`

Required headers:

```http
Authorization: Bearer flw_live_example_redacted
Idempotency-Key: order-123-created
Content-Type: application/json
```

Request:

```json
{
  "application_id":"app_001",
  "type":"order.created",
  "data":{"order_id":"ORD-123","amount":1500000}
}
```

Validation:
- `application_id`: required, enabled, belongs to authenticated organization and key allowlist.
- `type`: required, suggested pattern `^[a-z][a-z0-9_.-]{0,99}$`.
- `data`: JSON value must be an object for v0.1, valid JSON, combined body ≤ 256 KiB (pilot proposal).
- `Idempotency-Key`: mandatory, 1–128 safe printable characters; scope `(org,key identity,key value)`; equal normalized payload returns original event, different payload `409`.
- Only active subscribed endpoints under designated application are matched at acceptance. No automatic broadcast to other applications.

Accepted response (`202`), regardless of whether queue has dispatched:

```json
{
  "id":"evt_001",
  "status":"accepted",
  "application_id":"app_001",
  "type":"order.created",
  "delivery_count":2,
  "no_matching_reason":null,
  "accepted_at":"2026-10-11T07:00:00Z"
}
```

No match: same `202`, `delivery_count:0`, `no_matching_reason:"no_matching_subscriptions"`. Reused same idempotency key with same request: same event ID and response fields (server may include `idempotent_replay: true`). If transaction cannot commit, **never** return `202`. `429` includes `Retry-After` if known.

## 4. Applications and endpoints

`POST /v1/applications`

```json
{"name":"Customer Alpha"}
```

Response `201`: `{"id":"app_001","name":"Customer Alpha","status":"ACTIVE","created_at":"..."}`.

`PATCH /v1/applications/{id}` accepts `name`, `status` (`ACTIVE`, `DISABLED`). Disabling application blocks new publishes; document pending-delivery behavior in operations policy before launch.

`POST /v1/endpoints`

```json
{
  "application_id":"app_001",
  "name":"ERP webhook",
  "url":"https://erp.example.com/webhooks/flowup",
  "event_types":["order.created","invoice.paid"]
}
```

Response `201`: endpoint metadata, `status:"ENABLED"`, and `signing_secret` **shown exactly once**. Endpoint URL must be HTTPS and eligible public destination; reject user info/credentials in URL, unsafe ports and problematic redirects. Updates via `PATCH` accept `name`, `url`, `status`, `event_types`. Updating an endpoint's URL affects future deliveries only; existing ones retain snapshotted target URL (`PRD` edge case 6). Disabling cancels unsent pending deliveries, but a request already in flight may finish.

`POST /v1/endpoints/{id}/rotate-secret`: return new secret once, secret key version and activation details. **Open decision:** immediate vs grace rotation; before release, document exactly which version is used for pending deliveries. Prefer versioned secret snapshots with safe retention.

`POST /v1/api-keys`

```json
{"name":"production publisher","application_ids":["app_001"]}
```

Response `201` includes `{ "id": "key_...", "key": "flw_live_...", "prefix": "flw_live_...", "application_ids": ["app_001"] }`; `key` never appears in later `GET`. `POST /v1/api-keys/{id}/revoke` prevents future publish; already-accepted deliveries continue.

## 5. Events, deliveries and attempts

`GET /v1/events?application_id=app_001&type=order.created&from=...&to=...` returns event summaries. `GET /v1/events/{id}` includes immutable `data` only if role and retention policy permit; add `deliveries` as links or summary counts rather than huge inline attempt lists.

`GET /v1/deliveries?status=FAILED&endpoint_id=end_001&from=...&to=...` returns:

```json
{
  "data":[{
    "id":"del_001","event_id":"evt_001","endpoint_id":"end_001",
    "status":"FAILED","generation":0,"attempt_count":5,
    "next_attempt_at":null,"last_error_code":"http_503"
  }],"next_cursor":null
}
```

`GET /v1/deliveries/{id}` shows safe target host/URL according to permissions, event type, current state, generation, attempt count and next retry time. `GET /v1/deliveries/{id}/attempts` returns sorted attempts with `generation`, `attempt_number`, `started_at`, `duration_ms`, `http_status`, `result`, `error_code`; never include arbitrary response bodies/secrets.

`POST /v1/deliveries/{id}/replay`

```http
Idempotency-Key: replay-ui-operation-123
Content-Type: application/json
```

```json
{"reason":"Endpoint restored after outage"}
```

On final `FAILED` with enabled endpoint, schedule replay and return `202` `{ "delivery_id":"del_001", "generation":1, "status":"PENDING" }`. If active, succeeded, cancelled, endpoint disabled or duplicate conflicting operation, return `409` with stable error code; `403/404` for auth/ownership. Preserve previous attempt history and record actor/reason. Retry of exact same replay request should return prior scheduled generation rather than schedule another one; require replay idempotency storage.

`GET /v1/usage/summary?from=...&to=...` returns accepted_events, successful_deliveries, failed_deliveries, pending_deliveries and retries. No billing commitments implied.

## 6. Outbound webhook contract (FlowUp → consumer)

HTTP POST to the snapshotted HTTPS endpoint, with content type `application/json` and headers:

```http
FlowUp-Event-Id: evt_001
FlowUp-Delivery-Id: del_001
FlowUp-Event-Type: order.created
FlowUp-Timestamp: 1791702000
FlowUp-Signature: v1=<lowercase-hex-hmac>
FlowUp-Attempt: 1
FlowUp-Generation: 0
```

Example exact UTF-8 JSON body:

```json
{"id":"evt_001","type":"order.created","application_id":"app_001","data":{"order_id":"ORD-123","amount":1500000},"created_at":"2026-10-11T07:00:00Z"}
```

Signature V1: `HMAC_SHA256(secret, ascii(timestamp) + "." + raw_request_body_bytes)`, hex lowercase. The verification sample **must use raw HTTP request bytes** rather than re-serialize parsed JSON. Require sane timestamp freshness window on consumer (suggest 5 minutes) and constant-time comparison. Endpoint signing secret is independent from machine publish API key. Clock skew may affect verification; use UTC.

**Transport interpretation:** any 2xx succeeds; 429/5xx and network/timeout retry; remaining 4xx terminal by default. Disable redirects. Allow consumer idempotency by `FlowUp-Delivery-Id` or `FlowUp-Event-Id` according to its processing boundary; replay intentionally retains IDs and may be received twice.

## 7. Traceability and contract review

- `AT-01/08`: tenant/application scoped publish and subscriptions.
- `AT-02/03`: concurrent idempotency and conflict.
- `AT-04/05/06`: independent delivery, retry, signature.
- `AT-07`: replay generation + attempts.
- `AT-09/11`: SSRF and disabled endpoint.
- `AT-10/12`: outbox recovery, safe logs.

**Before freezing OpenAPI:** settle user session endpoints/CSRF, idempotency retention, explicit RBAC permissions for payload access, secret rotation, application-disable pending policy, and stable error code catalog. OpenAPI should be generated from a normative schema and checked in with contract tests.
