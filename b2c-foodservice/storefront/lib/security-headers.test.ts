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
});
