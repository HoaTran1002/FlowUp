# FlowUp — Industry Standards Alignment v0.1

**Document type:** Informative analysis · **Status:** Draft for architecture review · **Date:** 2026-10-11
**Precedence:** rank 13 (derived) in `AGENTS.md` §3.2. This document **changes no approved contract**. Every finding is a candidate for review; none is authorization to alter `docs/API_SPECIFICATION.md` or any other authoritative document.

## 1. Purpose and method

FlowUp's contracts were designed from its own requirements. This document compares them against the standards a prospective integrator or security reviewer is likely to apply, so that each divergence is a recorded decision rather than an accident.

For each standard: what FlowUp **aligns** with, where it **deliberately differs**, and where there is a genuine **gap**. Findings carry stable IDs (`SA-XX`) with a severity and an estimated cost of closing them.

**Verification caveat:** the external specifications cited here evolve, and some were drafts at the time of writing. Before acting on any finding, confirm the current published version and its exact section numbering. Section-level citations below are deliberately coarse for that reason.

## 2. Summary

| Area | Standard compared | Verdict |
|---|---|---|
| Webhook signing | Standard Webhooks | Mostly aligned; one substantive difference (`SA-01`) |
| Event envelope | CloudEvents 1.0 | Deliberate divergence (`SA-02`) |
| API error format | RFC 9457 Problem Details | Deliberate divergence (`SA-03`) |
| Idempotency | IETF `Idempotency-Key` header work | Aligned, stricter than the draft (`SA-04`) |
| HTTP semantics | RFC 9110 and related | Aligned |
| Rate limit signalling | `RateLimit` header fields work | Gap (`SA-05`) |
| Pagination | Prevailing API practice | Aligned |
| SSRF defence | OWASP SSRF guidance, CWE-918 | Exceeds common practice |
| Endpoint ownership | Prevailing webhook practice | **Gap (`SA-06`)** |
| Secret rotation | Prevailing dual-secret practice | Open decision (`SA-07`, ADR-02) |
| Retry horizon | Prevailing provider practice | Product decision (`SA-08`, ADR-04) |
| Access control, session, logging | OWASP ASVS | Aligned in intent; needs a mapped checklist (`SA-09`) |
| Tracing and metrics | OpenTelemetry semantic conventions | Gap (`SA-10`) |
| Data protection | GDPR minimisation and retention principles | Aligned in intent; retention undecided (ADR-04) |
| Supply chain | SBOM, pinned dependencies, provenance | Gap (`SA-11`) |
| Contract versioning | OpenAPI 3.1, Semantic Versioning | Partially aligned (`SA-12`) |

## 3. Webhook delivery standards

### 3.1 Standard Webhooks

**Aligned.** HMAC-SHA256 over a string that binds a timestamp to the raw body; a versioned signature prefix; a documented consumer freshness window with constant-time comparison; raw-byte verification rather than re-serialised JSON; stable IDs for consumer deduplication; at-least-once semantics stated openly. `docs/API_SPECIFICATION.md` §6 and `docs/TECHNICAL_DESIGN.md` §7 are materially consistent with the spirit of that specification.

**Differences.** Standard Webhooks signs `{id}.{timestamp}.{payload}`, carries lowercase `webhook-id` / `webhook-timestamp` / `webhook-signature` headers, and encodes the signature base64. FlowUp signs `timestamp + "." + raw_body`, uses `FlowUp-`prefixed headers, and encodes hex.

> **SA-01 — the message ID is outside the signed content.** *Severity: medium.*
> Because the signed string is timestamp plus body only, a signature is not cryptographically bound to `FlowUp-Event-Id` or `FlowUp-Delivery-Id`. Two different deliveries carrying an identical body within the same timestamp second produce an identical signature, so a captured request could be presented with substituted ID headers and still verify. Consumer deduplication relies on those unsigned headers.
> **Recommendation:** include the delivery ID in the signed string in a `v2` signature, offered alongside `v1`. **Cost:** a contract change (ADR-05), a verifier update, and a consumer migration window. Not a v0.1 blocker provided the limitation is documented.

Header naming is not a defect — HTTP field names are case-insensitive, and HTTP/2 and HTTP/3 lowercase them on the wire — but the published documentation should say so, since integrators matching `FlowUp-Signature` literally on an HTTP/2 connection will not find it. The `FlowUp-` prefix is correct practice; RFC 6648 deprecated the old `X-` convention.

### 3.2 CloudEvents 1.0

> **SA-02 — the outbound envelope is not CloudEvents-compatible.** *Severity: low.*
> FlowUp sends `{ id, type, application_id, data, created_at }`. CloudEvents requires `specversion` and `source` alongside `id` and `type`, and names the timestamp `time`. Consumers therefore cannot use an off-the-shelf CloudEvents SDK.
> **Recommendation:** keep the current envelope for v0.1 — it is smaller and sufficient — and record the divergence. If CloudEvents compatibility is later requested, add it as an opt-in content mode per endpoint rather than changing the default. **Cost:** contract change plus per-endpoint configuration; out of scope for v0.1 (`AGENTS.md` §2.3 excludes transformation features).

### 3.3 Endpoint ownership verification

> **SA-06 — endpoint registration does not prove control of the destination.** *Severity: medium-high.*
> A tenant may register any public HTTPS URL, including one belonging to an unrelated third party, and FlowUp will send signed POSTs to it. The SSRF controls in `docs/TECHNICAL_DESIGN.md` §6 prevent reaching *internal* targets but not an unwilling *external* one, which makes the platform a potential traffic-amplification vector and an abuse-report liability. Prevailing practice is a registration challenge: a one-time request the destination must echo, or a verification token, before the endpoint is enabled.
> **Recommendation:** add an endpoint verification step to `BE-06`, or record an explicit, reviewed acceptance of the risk for the invite-only pilot with rate limits and abuse monitoring as compensating controls. **Cost:** one endpoint state (`PENDING_VERIFICATION`), one challenge exchange, and a UI step in `FE-04`. This is the most significant gap in this document.

### 3.4 Retry policy

> **SA-08 — the retry horizon is short relative to the market.** *Severity: informational.*
> The pilot proposal is 5 attempts over 24 hours. Established providers commonly retry for several days. Exponential backoff with bounded jitter matches prevailing cloud guidance and is not in question; only the horizon is.
> **Recommendation:** treat as a product decision inside **ADR-04**, and ensure the published documentation states the horizon plainly so integrators can size their own recovery. No code change is implied — `docs/phase-1/BE-10.md` already requires these values to be configuration.

## 4. HTTP API standards

### 4.1 RFC 9457 Problem Details

> **SA-03 — the error envelope is custom rather than `application/problem+json`.** *Severity: low.*
> FlowUp returns `{"error":{"code","message","request_id","details"}}`. RFC 9457 defines `type`, `title`, `status`, `detail`, `instance` under the `application/problem+json` media type.
> **Recommendation:** keep the custom envelope for v0.1. It carries `request_id`, which Problem Details does not, and it is already specified and implemented against. Record the divergence and the mapping (`code` → `type`, `message` → `detail`, `request_id` → an extension member) so a later migration is mechanical. **Cost of migrating:** a breaking change to every error response plus client updates — not justified mid-pilot.

### 4.2 Idempotency

> **SA-04 — stricter than the draft, and correct in the strict direction.** *Severity: none.*
> FlowUp makes `Idempotency-Key` mandatory on publish, scopes it to `(organization, key identity, key value)`, fingerprints the canonical request, returns the original response on a match and `409` on a conflicting body. This matches the intent of the IETF `Idempotency-Key` header work and resolves the ambiguity the draft leaves open. Confirm the draft's current status before claiming conformance in published documentation.

One genuine risk is internal rather than standards-related: the canonicalisation algorithm defines the fingerprint, so changing it silently invalidates every stored fingerprint. `docs/phase-1/BE-07.md` requires it to be documented and pinned by fixtures.

### 4.3 Rate limit signalling

> **SA-05 — only `Retry-After` is returned on `429`.** *Severity: low.*
> There is no way for a producer to see its remaining budget before being throttled. The IETF `RateLimit` header field work defines `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` for exactly this.
> **Recommendation:** add the headers in `BE-13` as a non-breaking addition. **Cost:** low; the limiter already holds the values.

### 4.4 Pagination, status codes, timestamps

Aligned. Opaque cursor pagination with a deterministic `(created_at, id)` ordering and no total count matches prevailing large-API practice and avoids the correctness problems of offset paging. Status-code usage follows RFC 9110 semantics, including `202` for durable acceptance, `409` for conflict, `413` for payload size and `422` for semantic validation. Body timestamps are RFC 3339 UTC. Note that the outbound `FlowUp-Timestamp` is epoch seconds while `created_at` is RFC 3339 — consistent with prevailing webhook practice, but the published documentation should state both formats explicitly.

## 5. Security standards

### 5.1 SSRF — stronger than common practice

FlowUp's controls exceed what most implementations ship: validation at configuration *and* immediately before connection; resolution of A and AAAA records with a requirement that every candidate address be globally routable; pinning the connection to a validated IP while preserving SNI and TLS hostname verification; redirects disabled entirely; bounded response size; and refusal of proxy environment variables. This directly addresses CWE-918 and the DNS-rebinding weakness that defeats check-then-connect implementations, and it covers IPv6 and IPv4-mapped IPv6, which are commonly missed. No finding.

### 5.2 OWASP ASVS

> **SA-09 — ASVS intent is met but not mapped.** *Severity: low.*
> The requirements in `AGENTS.md` §7, `docs/SYSTEM_ARCHITECTURE.md` §6 and `docs/TEST_PLAN.md` §5 cover the ASVS themes that matter here: authentication, session management, access control, input validation, cryptography at rest, error handling and logging, and outbound request control. What is missing is a mapped checklist, which is what an enterprise security review will ask for.
> **Recommendation:** choose a target ASVS version and level, produce a requirement-by-requirement mapping to `FR-SEC-*`, `QA-AUTH-*` and `QA-SEC-*`, and record the exclusions. Pin the version — numbering changed materially between major ASVS releases. **Cost:** analysis only, no code.

Related weaknesses already addressed by name elsewhere: CWE-352 (CSRF — ADR-01), CWE-200 (information exposure — the `404` rule, INV-01), CWE-532 (secrets in logs — INV-08), CWE-307 (brute force — `BE-02`, `BE-05` limits).

### 5.3 Credential handling

Aligned with prevailing practice: reveal once, store hashed, high-entropy generation, prefixed keys for safe lookup and leak detection, encrypted and versioned endpoint secrets, revocation that blocks new publishes without retroactively invalidating accepted work.

> **SA-07 — rotation overlap is undecided.** *Severity: medium until ADR-02 closes.*
> Prevailing practice is a dual-secret window: both the old and the new secret verify for a defined grace period, so the consumer can deploy without a coordinated cutover. `docs/DATABASE_DESIGN.md` §3 already models `endpoint_secret_version`, so the data model supports it. An immediate cutover is acceptable only if pending deliveries are intentionally migrated or cancelled with documented behavior.
> **Recommendation:** choose the overlap window in ADR-02 and state the pending-delivery rule in the published contract. **Cost:** none structurally; the schema is already correct.

### 5.4 Data protection

Aligned in intent with the GDPR principles of data minimisation and storage limitation: payload retention is bounded, logs are redacted, backups are encrypted, employee access is restricted, and `docs/DATABASE_DESIGN.md` §7 forbids destroying audit history. The retention periods themselves are undecided (**ADR-04**), and a deletion or export path for a data-subject request is not specified. Record the latter as a pre-public-launch requirement rather than a pilot blocker, since the pilot is invite-only.

## 6. Operations standards

> **SA-10 — telemetry is not mapped to OpenTelemetry conventions.** *Severity: low.*
> `docs/SYSTEM_ARCHITECTURE.md` §7 specifies the right fields and metrics, including a trace ID, but names no conventions. Adopting OpenTelemetry semantic conventions for HTTP client spans, messaging spans and resource attributes makes the signals portable to any backend and comparable with other systems.
> **Recommendation:** adopt the conventions in `BE-13` for span and attribute naming. **Cost:** low if done before the instrumentation is written; higher afterwards.

> **SA-11 — no supply-chain controls are specified.** *Severity: medium.*
> No document requires a lockfile integrity check, dependency vulnerability scanning, an SBOM, or build provenance. `docs/phase-1/BE-01.md` requires a frozen lockfile in CI, which is a start.
> **Recommendation:** add dependency scanning and SBOM generation to the CI pipeline in `BE-13`, and record a policy for responding to an advisory. **Cost:** low; standard tooling.

> **SA-12 — API versioning policy is implicit.** *Severity: low.*
> The API is versioned by path (`/v1`) and will publish OpenAPI 3.1 from a normative schema (`BE-14`), which is correct. What is not written down is the compatibility policy: what counts as a breaking change, how long a version is supported, and how a deprecation is announced. The error-code catalogue has the same exposure — once published, a code name is a contract.
> **Recommendation:** publish a one-page compatibility and deprecation policy alongside the OpenAPI document in `BE-14`. **Cost:** documentation only.

## 7. Findings register

| ID | Finding | Severity | Owner task | Blocks pilot? |
|---|---|---|---|---|
| SA-06 | Endpoint ownership is not verified | medium-high | `BE-06`, `FE-04` | Decision required: fix or record accepted risk |
| SA-01 | Message ID outside the signed content | medium | `BE-09`, `BE-14` (ADR-05) | No — document the limitation |
| SA-07 | Secret rotation overlap undecided | medium | `BE-06` (ADR-02) | Yes — ADR-02 already gates the pilot |
| SA-11 | No supply-chain controls | medium | `BE-13` | No |
| SA-09 | ASVS mapping absent | low | security review | No |
| SA-05 | No `RateLimit` headers | low | `BE-13` | No |
| SA-10 | Telemetry not mapped to OpenTelemetry | low | `BE-13` | No |
| SA-12 | No compatibility and deprecation policy | low | `BE-14` | No |
| SA-03 | Custom error envelope, not RFC 9457 | low | — | No — recorded divergence |
| SA-02 | Envelope not CloudEvents-compatible | low | — | No — recorded divergence |
| SA-08 | Retry horizon short for the market | informational | ADR-04 | No |
| SA-04 | Idempotency stricter than the draft | none | — | No |

## 8. Conclusion

FlowUp's correctness and egress-security posture is at or above prevailing practice: the transactional outbox with durable acceptance, a single database-owned retry authority, append-only attempt history, honest at-least-once semantics, and connection-time IP validation are all stronger than typical implementations.

The divergences in envelope and error format are defensible and should simply be recorded. Two findings deserve a decision before the external pilot: **SA-06** (endpoint ownership verification), which is an abuse-surface question rather than a correctness one, and **SA-07**, which **ADR-02** already blocks the pilot on.

Nothing in this document authorises a contract change. Each finding that a reviewer accepts becomes a change request against the owning authoritative document, through `AGENTS.md` §3.5.
