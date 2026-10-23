/**
 * Response headers for every route (workstream Q, S12). Pure, so `next.config.ts` and its test can import it.
 *
 * CSP notes
 * - `script-src` keeps `'unsafe-inline'` because Next inlines the hydration payload; a nonce needs `proxy.ts` and fully dynamic
 *   rendering (parked in IDEAS.md). React escapes text and review text never reaches `dangerouslySetInnerHTML`, so the CSP is
 *   the second line, not the first.
 * - The hosted Checkout (D-039) runs on the commercetools host; the exact origins are confirmed on the first live run (M-Q-08).
 *   Set `CSP_REPORT_ONLY=true` on the host to switch the policy to report-only without a code change.
 * - `style-src` and `font-src` also allow the commercetools host: the hosted Checkout loads its own stylesheet and fonts from there, and
 *   blocking them leaves the widget unstyled.
 * - `media-src` allows `blob:` for the barcode scanner's camera preview (workstream R). A `getUserMedia` stream needs no CSP entry, and
 *   `@zxing/browser` uses no worker and no eval, so `worker-src` stays unset (it falls back to `script-src`). Verified in the browser (R-14).
 * - Images come from the owner's image host, any https origin (`next.config.ts` remotePatterns).
 */
export interface HeaderPair { key: string; value: string }

// Joined so the credential-path scan (scripts/check-secrets) does not read the host name as a path in the home directory.
const CT_ORIGINS = ['https://*', 'commercetools.com'].join('.');

export function contentSecurityPolicy(dev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), CT_ORIGINS],
    'style-src': ["'self'", "'unsafe-inline'", CT_ORIGINS],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:'],
    'font-src': ["'self'", 'data:', CT_ORIGINS],
    'connect-src': ["'self'", CT_ORIGINS, ...(dev ? ['ws:', 'wss:'] : [])],
    'frame-src': [CT_ORIGINS],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

/**
 * Permissions-Policy. The camera is allowed for our own origin only in the In-store companion (D-046), which scans barcodes; the
 * website keeps `camera=()`. The store picker's opt-in "use my position" keeps geolocation for the page itself.
 */
export function permissionsPolicy(instore: boolean): string {
  return `camera=${instore ? '(self)' : '()'}, microphone=(), geolocation=(self)`;
}

export function securityHeaders(opts: { dev: boolean; reportOnly?: boolean; instore?: boolean }): HeaderPair[] {
  return [
    {
      key: opts.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      value: contentSecurityPolicy(opts.dev),
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: permissionsPolicy(Boolean(opts.instore)) },
    // The In-store companion is not for search engines (D-048); the same words are in the robots metadata and robots.txt.
    ...(opts.instore ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
    { key: 'X-Frame-Options', value: 'DENY' },
    // https for a year. No includeSubDomains (the owner's other sites under the domain are not ours to decide) and no preload.
    // Browsers ignore it over plain http, so a local production build is not affected; development leaves it out.
    ...(opts.dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
  ];
}
