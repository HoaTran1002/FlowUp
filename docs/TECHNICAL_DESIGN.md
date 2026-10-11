# FlowUp — Technical Design v0.1

**Status:** Implementation blueprint; not a replacement for URD/PRD or API contract.  
**Stack:** Bun workspaces; NestJS/TypeScript; Prisma/PostgreSQL; Redis/BullMQ; React + TanStack Router/Query + Axios + shadcn/ui.

## 1. Repository and runtime

```text
flowup/
  apps/
    api/               # NestJS HTTP app and modules
    worker/            # NestJS application context: delivery processor
    dispatcher/        # NestJS application context: outbox enqueue + reconciliation
    web/               # React application
  packages/
    contracts/         # Zod types + OpenAPI-derived client types
    config/            # env schema, shared telemetry config
  infrastructure/
    docker-compose.yml
    migrations/        # optional raw SQL index/constraints
  docs/
    PRODUCT_OVERVIEW.md URD.md PRD.md
    SYSTEM_ARCHITECTURE.md DATABASE_DESIGN.md API_SPECIFICATION.md TECHNICAL_DESIGN.md
  package.json bun.lock
```

Use Bun for workspace/package manager and test compatibility. **Runtime choice must be verified** with the exact versions of NestJS, Prisma generator/driver, BullMQ and dependencies; run production smoke tests. If Bun runtime compatibility is blocked, keep Bun as package manager and run NestJS processes on supported Node.js LTS without changing product architecture.

## 2. NestJS module layout

| Module | Responsibility | Key dependency |
|---|---|---|
| `AuthModule` | dashboard sessions, membership, CSRF, RBAC | Prisma |
| `ApiKeysModule` | machine key generation/hash/validation, scoped permissions | Prisma |
| `ApplicationsModule` | logical recipients | Prisma |
| `EndpointsModule` | public HTTPS URLs, subscriptions, secrets/rotation | Prisma + crypto |
| `EventsModule` | validate + transactional publish + idempotency | Prisma |
| `DeliveriesModule` | status query, replay, per-delivery policies | Prisma |
| `OutboxModule` | enqueue durable dispatch intents | Prisma + BullMQ producer |
| `WorkerModule` | lease/attempt/send/result | Prisma + HTTP egress client |
| `AuditModule` | structured event metadata (no secrets) | Prisma |
| `ObservabilityModule` | metrics/logs/traces | telemetry |

Prisma migrations centralized in one location, not generated independently per executable. Keep domain services reusable; HTTP controllers never import worker internals.

## 3. Publish path pseudocode

```typescript
async function publish(apiKeyIdentity, idempotencyKey, input) {
  validateInputAndQuotas(input);
  assertApplicationAuthorized(apiKeyIdentity, input.application_id);
  const fingerprint = hashCanonicalPublishRequest(input);
  return prisma.$transaction(async (tx) => {
    // Unique key in DB arbitrates concurrent duplicates.
    const existing = await findIdempotentEvent(tx, apiKeyIdentity, idempotencyKey);
    if (existing) return equal(existing.requestFingerprint, fingerprint)
      ? existing.acceptedResponse : conflict();
    const matches = await findSubscribedEnabledEndpoints(tx, apiKeyIdentity.orgId, input);
    const event = await createImmutableEvent(tx, input, fingerprint, idempotencyKey);
    for (const endpoint of matches) {
      const delivery = await createDeliveryWithUrlAndSecretSnapshot(tx, event, endpoint);
      await createOutboxIntent(tx, delivery, 0, 1);
    }
    return acceptedResponse(event, matches.length);
  });
}
```

Handle uniqueness conflict by reading the committed winner **after** the conflicting transaction resolves; never return `202` for incomplete DB state. Canonicalize request strictly: use validated typed payload and a deterministic JSON canonicalization algorithm (e.g., sorted object keys recursively); explicitly treat number normalization, string encoding and arrays. Same semantic request needs stable fingerprint; two different payloads cannot accidentally compare equal.

## 4. Dispatcher with BullMQ

- Poll `outbox_message` rows whose `state=PENDING` and `available_at<=now()`, claim batch with `FOR UPDATE SKIP LOCKED`/lease. Use short DB transaction to claim, then call Redis outside DB transaction.
- `queue.add('deliver', {deliveryId,generation,attemptNumber}, {jobId: deterministicJobId, delay: computedDelay})` with lightweight payload only. Decide whether `available_at` drives delay or dispatcher only enqueues when due; **recommended:** dispatcher enqueues due jobs with no extra queue delay, DB owns schedule.
- Mark outbox `ENQUEUED` after accepted by Redis. If dispatcher crashes between queue.add and DB update, duplicate enqueue is possible; deterministic job ID plus worker claim handles this.
- Periodic reconciliation queries DB for due deliveries with no usable job and expired outbox leases, recreates missing enqueue intents after Redis loss. A DB row never becomes irrecoverable simply because BullMQ job was removed.
- `removeOnComplete` and `removeOnFail` queue cleanup are optional operational optimization only; authoritative history lives in DB.

**Important:** Do not rely on BullMQ built-in `attempts` as the only retry engine *while also creating per-attempt DB outbox jobs*. Pick one authoritative mechanism: **v0.1 uses DB scheduling and one BullMQ execution per attempt** (`attempts:1`), because delivery-attempt history and recovery are explicit. BullMQ still gives concurrency/worker execution/coordination. This prevents doubled retry schedules.

## 5. Worker execution algorithm

```text
receive {deliveryId, generation, attemptNumber}
  → atomically claim DB delivery lease if due, status valid, generation current
  → no-op if stale/terminal/already leased
  → check application/endpoint enabled and destination snapshot safety
  → create STARTED attempt (unique generation+attemptNumber)
  → build raw JSON envelope, timestamp, HMAC using secret snapshot version
  → connect to verified public IP over TLS for URL hostname; redirects disabled
  → POST with bounded timeout/response size
  → conditional finalize DB attempt + delivery state and next outbox intent
```

Lease owner uses unguessable token, `lease_expires_at`, heartbeat if timeout/pause can exceed lease. Keep lease > HTTP timeout + processing margin; guard stale workers from finalizing state after another worker reclaimed. If crash after HTTP send, recovery may reattempt => at least once. STARTED attempt older than lease becomes UNKNOWN and remains immutable as an outcome record.

Error policy:

| Result | Behavior |
|---|---|
| HTTP 200–299 | SUCCEEDED |
| HTTP 429 | retryable; optionally honor bounded numeric `Retry-After` |
| HTTP 500–599 | retryable |
| Timeout, connection reset, temporary DNS | retryable if destination safe |
| HTTP 400–428 (except 429), 430–499 | FAILED terminal by default |
| Unsafe destination, malformed URL, TLS validation failure | FAILED terminal, no unsafe fallback |
| Retry budget/window exceeded | FAILED |

Retry schedule proposal for 5 **total** attempts: `delay = min(cap, 5000ms * 2^(attemptNumber - 1)) * jitterFactor`, with bounded jitter factor e.g. [0.8,1.2], max age 24h; attempt 1 immediate. All retry scheduling stored in `delivery.next_attempt_at` and next outbox intent. Timeout proposal 10s. Confirm during pilot tests.

## 6. SSRF-safe HTTP egress

This is a high-risk feature: a tenant selects the URL that worker will request.

- Validate on configuration and on every send; only public HTTPS, disallow URL credentials, fragment, non-allowlisted ports and URL normalization tricks.
- Resolve A/AAAA; ensure **all selected candidate IPs are globally routable/public**. Force HTTP client connection to a validated IP while retaining original SNI/Host and TLS certificate verification for domain (prevent DNS rebinding between check and connect).
- Block redirects entirely at v0.1. Refuse HTTP proxy environment variables unless approved and security-tested.
- Network egress deny private/metadata destinations as defense in depth. Protect against IPv6, IPv4-mapped IPv6, DNS rebinding, cloud metadata, loopback and link-local.
- Limit HTTP response bytes and headers, timeouts and outbound concurrent connections. No logging of full response body.
- Test malicious hosts using a controlled test resolver / network rather than contacting actual internal infrastructure.

## 7. Secrets and signing

- Generate keys using cryptographic RNG. Publish key: one-time plaintext; hash stored, hashed verification with lookup-friendly random key ID/prefix.
- Endpoint signing secret: encrypt via authenticated encryption with deployment-managed key; store version and expiry. Signing secret cannot be retrieved after creation except newly rotated version.
- Sign exact request UTF-8 bytes and timestamp: `HMAC_SHA256(secret, timestamp + '.' + rawBody)` as in API Specification. Include `FlowUp-Signature: v1=<hex>` and stable IDs.
- Consumer sample verifier must compare in constant time, check freshness and deduplicate processed delivery ID. Cross-language verification test fixes canonical raw bytes in fixture.

## 8. Frontend integration

- React, TanStack Router for authenticated routes, TanStack Query for cache/mutations, Axios with typed client and consistent error normalization, shadcn/ui/Tailwind.
- Views: Overview, Applications, Endpoints, API Keys (Admin only), Events, Deliveries, Delivery Detail with attempt timeline, Replay confirmation.
- Never persist API key or signing secret in browser local storage; show once and prompt copy; don't store secrets in query cache or analytics.
- Use server-side pagination and filters; action visibility follows role but backend is sole authorization gate.
- UI state: empty/pending/retry_wait/success/failed/cancelled, stale query retries, error details sanitized. Replay confirms duplicate-processing warning.

## 9. Local development and testing

Start with Docker Compose PostgreSQL + Redis, isolated services, seeded organization/application/test endpoint. Test through a controlled HTTPS receiver (real public HTTPS test host only with permission, or local integration test harness using mocked egress).

Test layers:

| Test | Description | Trace |
|---|---|---|
| Unit | URL/policy validator, idempotency fingerprint, retry classifier/backoff, HMAC byte verifier | `AT-03,05,06,09` |
| DB integration | transaction persistence, unique conflict under concurrency, composite scope FK, outbox re-enqueue | `AT-01,02,08,10` |
| Worker integration | 200/503/429/400/timeout, endpoint disabled, lease expiry, same event independent endpoints | `AT-04,05,11` |
| Security | cross-tenant reads/publish, malicious URL, DNS rebinding, redirects, secret redaction | `AT-08,09,12` |
| Recovery chaos | Redis down at commit; dispatcher crash after add; worker crash after downstream 2xx; Redis job loss | `AT-04,10` |
| E2E | one org, two endpoints, signed delivery, failure → retry, history → replay | `AT-01,06,07,12` |
| Capacity | bounded queue backlog, p95 acceptance latency and delivery latency at pilot traffic | `NFR-07,08,10` |

## 10. Deployment checklist

- Env schema fail-fast; secrets outside repository; production HTTPS; health vs readiness endpoints for each process.
- PostgreSQL automated backups, restore drill, migrations and recovery procedure; Redis memory alarms/noeviction/persistence.
- DB connection pool sizing across api/worker/dispatcher; bounded worker concurrency and publish rate limiting.
- Graceful shutdown: stop claiming, drain HTTP within deadline, leave leases recoverable.
- Dedicated alert on aged pending outbox/deliveries; sanitized structured logs and telemetry.
- Validate Bun/NestJS/Prisma/BullMQ exact versions in CI and production-like Docker smoke test.

## 11. Engineering decisions to finalize before first release

1. API session/bootstrap and CSRF strategy.
2. ORM use of raw SQL for worker claims, outbox leases and partial indexes.
3. Secret rotation grace period, pending delivery key version semantics.
4. Idempotency key retention and replay-idempotency persistence.
5. Limits (payload size, throughput/organization, endpoint count, retention, timeout, retry horizon).
6. Redis persistence configuration, production deployment target and backup/restore.
7. Hardening of DNS-pinned TLS egress in selected HTTP client.

## 12. Traceability

| PRD area | Implementation unit | Acceptance |
|---|---|---|
| `FR-ORG-*`, `FR-KEY-*`, `FR-APP-*` | Auth, API Keys, Applications | `AT-08` |
| `FR-END-*` | Endpoints + safe URL + versioned secrets | `AT-01,09,11` |
| `FR-EVT-*` | Event transaction + idempotency | `AT-01,02,03,10` |
| `FR-DEL-*`, `FR-RET-*` | Outbox, BullMQ, Worker | `AT-04,05,06,10` |
| `FR-OBS-*`, `FR-REP-*` | Query, attempt log, replay | `AT-07,12` |
| `FR-SEC-*`, `NFR-*` | RBAC, SSRF, telemetry/retention | `AT-08,09,12` |

**Next phase:** UI/UX Specification → Implementation Plan → Test Plan. No extra business scope without updating PRD/URD and traceability.
