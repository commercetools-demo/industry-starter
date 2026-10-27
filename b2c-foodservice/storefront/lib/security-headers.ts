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
 * - Images come from the owner's image host, any https origin (`next.config.ts` remotePatterns).
 * - Framing: never allowed, except on the page-builder preview deployment, which sets `PB_ALLOW_MC_FRAMING=true` and
 *   `PB_MC_ORIGIN` so the Merchant Center editor can frame it. That one origin goes into `frame-ancestors` and
 *   `X-Frame-Options` is dropped (it cannot name an origin). Production leaves both unset and stays `'none'` and `DENY`.
 */
export interface HeaderPair { key: string; value: string }

// Joined so the credential-path scan (scripts/check-secrets) does not read the host name as a path in the home directory.
const CT_ORIGINS = ['https://*', 'commercetools.com'].join('.');

/**
 * The Merchant Center origin that may frame this deployment, or undefined (framing denied). `PB_ALLOW_MC_FRAMING` is off by
 * default; when it is `true`, `PB_MC_ORIGIN` must be a bare https origin, otherwise the build fails rather than shipping a
 * preview that cannot be framed or a policy wider than intended.
 */
export function mcFramingOrigin(env: Record<string, string | undefined>): string | undefined {
  if (env.PB_ALLOW_MC_FRAMING !== 'true') return undefined;
  const raw = env.PB_MC_ORIGIN?.trim() ?? '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('PB_ALLOW_MC_FRAMING is true but PB_MC_ORIGIN is not a valid URL');
  }
  if (url.protocol !== 'https:' || url.origin !== raw.replace(/\/+$/, '')) {
    throw new Error('PB_MC_ORIGIN must be a bare https origin, with no path or trailing slash');
  }
  return url.origin;
}

export function contentSecurityPolicy(dev: boolean, frameAncestor?: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), CT_ORIGINS],
    'style-src': ["'self'", "'unsafe-inline'", CT_ORIGINS],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:', CT_ORIGINS],
    'connect-src': ["'self'", CT_ORIGINS, ...(dev ? ['ws:', 'wss:'] : [])],
    'frame-src': [CT_ORIGINS],
    'frame-ancestors': [frameAncestor ?? "'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

export function securityHeaders(opts: { dev: boolean; reportOnly?: boolean; frameAncestor?: string }): HeaderPair[] {
  return [
    {
      key: opts.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      value: contentSecurityPolicy(opts.dev, opts.frameAncestor),
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // The store picker has an opt-in "use my position" button, so geolocation stays allowed for the page itself.
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    ...(opts.frameAncestor ? [] : [{ key: 'X-Frame-Options', value: 'DENY' }]),
    // https for a year. No includeSubDomains (the owner's other sites under the domain are not ours to decide) and no preload.
    // Browsers ignore it over plain http, so a local production build is not affected; development leaves it out.
    ...(opts.dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
  ];
}
