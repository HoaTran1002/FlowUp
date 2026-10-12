/**
 * FE-01 §2.3 — configuration comes from `import.meta.env` only.
 *
 * `VITE_API_BASE_URL` is the single build-time input in phase 1 and it is not a
 * secret (docs/phase-1/README.md §7). Validation runs at module load so a
 * missing value fails loudly instead of producing requests against the page's
 * own origin.
 */

export interface WebEnv {
  /** Origin of the FlowUp management API, with no trailing slash and no path. */
  readonly apiBaseUrl: string;
  readonly isDevelopment: boolean;
  readonly mode: string;
}

export function readEnv(source: ImportMetaEnv): WebEnv {
  const raw: unknown = source.VITE_API_BASE_URL;

  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      'VITE_API_BASE_URL is required. Copy .env.example to .env at the repository root and set it.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`VITE_API_BASE_URL must be an absolute URL, received: ${raw}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`VITE_API_BASE_URL must use http or https, received: ${parsed.protocol}`);
  }

  return {
    apiBaseUrl: `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`,
    isDevelopment: source.DEV,
    mode: source.MODE,
  };
}

export const env: WebEnv = readEnv(import.meta.env);
