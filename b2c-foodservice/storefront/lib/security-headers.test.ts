import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

describe('security headers', () => {
  it('production policy denies framing, plugins and foreign base and form targets', () => {
    const csp = contentSecurityPolicy(false);
    for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", "default-src 'self'"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toContain('unsafe-eval');
  });
  it('development policy adds eval and websockets for hot reload only', () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(false)).not.toContain('ws:');
  });
  it('every header of the review list is present', () => {
    const keys = securityHeaders({ dev: false }).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining([
      'Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options',
    ]));
  });
  it('report only switch renames the policy header', () => {
    const keys = securityHeaders({ dev: false, reportOnly: true }).map((h) => h.key);
    expect(keys).toContain('Content-Security-Policy-Report-Only');
    expect(keys).not.toContain('Content-Security-Policy');
  });
  it('production tells browsers to use https for a year; development (plain http) does not', () => {
    const prod = securityHeaders({ dev: false }).find((h) => h.key === 'Strict-Transport-Security');
    expect(prod?.value).toBe('max-age=31536000');
    expect(securityHeaders({ dev: true }).map((h) => h.key)).not.toContain('Strict-Transport-Security');
  });

  it('lets the hosted Checkout load its stylesheet and fonts', () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toMatch(/style-src [^;]*https:\/\/\*\.commercetools\.com/);
    expect(csp).toMatch(/font-src [^;]*https:\/\/\*\.commercetools\.com/);
  });

  it('Permissions-Policy camera=(self) in instore mode only', () => {
    const value = (instore?: boolean) => securityHeaders({ dev: false, ...(instore === undefined ? {} : { instore }) }).find((h) => h.key === 'Permissions-Policy')?.value;
    expect(value(true)).toBe('camera=(self), microphone=(), geolocation=(self)');
    expect(value(false)).toBe('camera=(), microphone=(), geolocation=(self)');
    expect(value()).toBe('camera=(), microphone=(), geolocation=(self)');
    expect(value(true)).not.toMatch(/camera=\(\*\)|camera=\*/);
  });

  it('CSP has media-src for the camera preview and no worker or eval for the scanner', () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).not.toContain('worker-src');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('X-Robots-Tag noindex only in instore mode', () => {
    const tag = (instore: boolean) => securityHeaders({ dev: false, instore }).find((h) => h.key === 'X-Robots-Tag')?.value;
    expect(tag(true)).toBe('noindex, nofollow');
    expect(tag(false)).toBeUndefined();
  });
});
