// Client-safe: the policy slugs and their path. Kept apart from `policies.ts` (which reads files with node:fs) so that a client component,
// such as the checkout's consent text (workstream U, via `PolicyLink`), can use them without pulling the file system into the browser bundle.
export const LEGAL_SLUGS = ['shipping-returns', 'terms', 'privacy'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

/** Locale-agnostic path; callers use the locale-aware `Link`. */
export function legalPath(policy: LegalSlug): string {
  return `/legal/${policy}`;
}
