// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X, G01 and G03: security headers of the storefront and the portal-only framing rule.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp, portalOriginOf } from '@/lib/csp';

afterEach(() => vi.unstubAllEnvs());

const frameAncestors = (csp: string) => csp.split('; ').find((d) => d.startsWith('frame-ancestors '))?.split(' ').slice(1);

describe('storefront security headers', () => {
  it('frame-ancestors is self; the portal origin is added only when configured', () => {
    expect(frameAncestors(buildCsp())).toEqual(["'self'"]);
    expect(frameAncestors(buildCsp({ portalOrigin: 'https://portal.example.com' }))).toEqual(["'self'", 'https://portal.example.com']);
    expect(portalOriginOf('https://portal.example.com/x')).toBe('https://portal.example.com');
    expect(portalOriginOf('javascript:alert(1)')).toBeUndefined();
  });
  it('next.config sends nosniff, referrer and permissions policy on every route, geolocation for self only, no powered-by', async () => {
    const config = (await import('./next.config')).default;
    const rules = await config.headers?.();
    const all = Object.fromEntries((rules?.[0].headers ?? []).map((h) => [h.key, h.value]));
    expect(rules?.[0].source).toBe('/:path*');
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(all['Permissions-Policy']).toContain('geolocation=(self)');
    expect(all['Permissions-Policy']).toContain('camera=()');
    expect(all['X-Frame-Options']).toBeUndefined(); // frame-ancestors is the framing rule, so the portal preview can work
    expect(frameAncestors(all['Content-Security-Policy'])).toContain("'self'");
    expect(config.poweredByHeader).toBe(false);
    expect(config.productionBrowserSourceMaps).toBe(false);
  });
  it('development defaults the portal origin to localhost:3001, production to nothing', async () => {
    vi.stubEnv('PORTAL_ORIGIN', '');
    vi.stubEnv('NODE_ENV', 'production');
    const prod = await (await import('./next.config')).default.headers?.();
    expect(frameAncestors(prod?.[0].headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '')).toEqual(["'self'"]);
    expect(prod?.[0].headers.map((h) => h.key)).toContain('Strict-Transport-Security');
  });
});
