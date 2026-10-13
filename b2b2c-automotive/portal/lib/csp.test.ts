// @vitest-environment node
// Workstream X, G01 and G10: portal CSP and the headers next.config.ts sends.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp, originOf } from '@/lib/csp';

const directive = (csp: string, name: string): string[] =>
  (csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? []);

afterEach(() => vi.unstubAllEnvs());

describe('portal CSP', () => {
  it('no unsafe-eval in production; development only for React refresh', () => {
    expect(buildCsp()).not.toContain('unsafe-eval');
    expect(directive(buildCsp({ dev: true }), 'script-src')).toContain("'unsafe-eval'");
  });
  it('nobody may frame the portal, no plugins, no foreign form targets, no foreign base', () => {
    const csp = buildCsp();
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
  });
  it('connect-src is self only: the browser never calls commercetools, Contentools or the geocoder', () => {
    expect(directive(buildCsp(), 'connect-src')).toEqual(["'self'"]);
    expect(buildCsp()).not.toMatch(/commercetools\.com|contentools|nominatim/i);
  });
  it('only the storefront origin is framable by the preview', () => {
    expect(directive(buildCsp({ storefrontOrigin: 'https://shop.example.com' }), 'frame-src')).toEqual(["'self'", 'https://shop.example.com']);
    expect(originOf('https://shop.example.com/de-DE/x')).toBe('https://shop.example.com');
    expect(originOf('javascript:alert(1)')).toBeUndefined();
    expect(originOf('')).toBeUndefined();
  });
  it('next.config sends the CSP, nosniff, frame options DENY and noindex on every route, and no powered-by header', async () => {
    const config = (await import('../next.config')).default;
    const rules = await config.headers?.();
    expect(rules?.[0].source).toBe('/:path*');
    const keys = Object.fromEntries((rules?.[0].headers ?? []).map((h) => [h.key, h.value]));
    expect(keys['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(keys['X-Content-Type-Options']).toBe('nosniff');
    expect(keys['X-Frame-Options']).toBe('DENY');
    expect(keys['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(keys['X-Robots-Tag']).toContain('noindex');
    expect(config.poweredByHeader).toBe(false);
    expect(config.productionBrowserSourceMaps).toBe(false);
  });
  it('robots.txt disallows everything', async () => {
    const robots = (await import('../app/robots')).default();
    expect(robots.rules).toEqual({ userAgent: '*', disallow: '/' });
  });
});
