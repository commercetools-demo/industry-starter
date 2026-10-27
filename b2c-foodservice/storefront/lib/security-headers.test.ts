import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, mcFramingOrigin, securityHeaders } from './security-headers';

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

  describe('framing by the Merchant Center (page-builder preview)', () => {
    const MC = 'https://food-service.mc-preview.us-central1.gcp.commercetools.com';

    it('default is deny: the policy and headers are the production ones', () => {
      expect(contentSecurityPolicy(false)).toContain("frame-ancestors 'none'");
      expect(securityHeaders({ dev: false }).find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
      expect(mcFramingOrigin({})).toBeUndefined();
      expect(mcFramingOrigin({ PB_ALLOW_MC_FRAMING: 'false', PB_MC_ORIGIN: MC })).toBeUndefined();
    });

    it('allows exactly the Merchant Center origin and drops X-Frame-Options', () => {
      const headers = securityHeaders({ dev: false, frameAncestor: MC });
      const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
      expect(csp).toContain(`frame-ancestors ${MC};`);
      expect(csp).not.toContain("frame-ancestors 'none'");
      expect(headers.map((h) => h.key)).not.toContain('X-Frame-Options');
    });

    it('the rest of the policy does not change when framing is allowed', () => {
      const strip = (v: string) => v.replace(/frame-ancestors [^;]*;?/, '');
      expect(strip(contentSecurityPolicy(false, MC))).toBe(strip(contentSecurityPolicy(false)));
    });

    it('reads the origin from the environment', () => {
      expect(mcFramingOrigin({ PB_ALLOW_MC_FRAMING: 'true', PB_MC_ORIGIN: `${MC}/` })).toBe(MC);
    });

    it.each([
      ['missing', undefined],
      ['not a URL', 'food-service'],
      ['http', 'http://food-service.example.com'],
      ['with a path', `${MC}/projects`],
    ])('fails the build when the flag is on and the origin is %s', (_name, origin) => {
      expect(() => mcFramingOrigin({ PB_ALLOW_MC_FRAMING: 'true', ...(origin ? { PB_MC_ORIGIN: origin } : {}) })).toThrow();
    });
  });
});
