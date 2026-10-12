import type { InternalAxiosRequestConfig } from 'axios';

/**
 * ADR-01 extension point — the ONLY place a CSRF mechanism will be attached.
 *
 * `API_SPECIFICATION.md` §1 states that the management API uses a Secure,
 * HttpOnly, SameSite session cookie plus CSRF protection, but the token
 * mechanism itself (header name, token source, refresh) is part of the
 * unresolved ADR-01 contract (docs/phase-1/README.md §5).
 *
 * FE-01 therefore implements nothing here: a guessed header name or a token
 * read from a cookie this frontend invented would be speculative security.
 * FE-02 replaces this function body once the contract is approved, and no
 * other module needs to change.
 */
export function attachCsrfToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  return config;
}
