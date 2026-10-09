// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '../next.config';
import { contentSecurityPolicy, IMAGE_HOSTS, securityHeaders } from './security-headers';

describe('malva-project-bootstrap › Security headers', () => {
  it('the built config sends every header on every path', async () => {
    const rules = await config.headers!();
    const all = rules.find((r) => r.source === '/:path*')!.headers;
    for (const key of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options']) expect(all.map((h) => h.key)).toContain(key);
  });
  it('CSP forbids framing, plugins and foreign scripts; images only from the known hosts', () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*(\*|https:)/);
    expect(csp).not.toContain('unsafe-eval');
    for (const host of IMAGE_HOSTS) expect(csp).toContain(host);
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });
  it('production sends no websocket allowance', () => { expect(contentSecurityPolicy(false)).not.toContain('ws:'); });
  it('image hosts match the Next image config', () => {
    const patterns = (config.images?.remotePatterns ?? []).map((p) => (typeof p === 'object' && 'hostname' in p ? `${p.protocol}://${p.hostname}` : ''));
    expect(patterns.sort()).toEqual([...IMAGE_HOSTS].sort());
  });
  it('X-Frame-Options and Referrer-Policy values', () => {
    const h = Object.fromEntries(securityHeaders().map((x) => [x.key, x.value]));
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
