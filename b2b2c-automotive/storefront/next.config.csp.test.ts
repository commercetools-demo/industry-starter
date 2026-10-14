// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp, extraImageHosts } from '@/lib/csp';

const directive = (csp: string, name: string): string[] =>
  (csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? []);

afterEach(() => vi.unstubAllEnvs());

describe('Store picker CSP', () => {
  it('the OSM tile host is the only third-party image host', () => {
    const img = directive(buildCsp(), 'img-src');
    expect(img.filter((v) => v.startsWith('http'))).toEqual(['https://tile.openstreetmap.org']);
    expect(img).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']));
  });
  it('connect-src is self only: no tiles by fetch, no geocoder, no commercetools', () => {
    expect(directive(buildCsp(), 'connect-src')).toEqual(["'self'"]);
    expect(buildCsp()).not.toMatch(/nominatim|commercetools\.com|contentools/i);
  });
  it('no unsafe-eval is added for Leaflet (production)', () => {
    expect(buildCsp()).not.toContain('unsafe-eval');
    expect(directive(buildCsp({ dev: true }), 'script-src')).toContain("'unsafe-eval'");
  });
  it('seller image hosts come only from CSP_IMG_HOSTS and must be https origins', () => {
    expect(extraImageHosts('https://images.example.test, http://insecure.test, javascript:alert(1), https://cdn.example.test/path, https://u:p@evil.test')).toEqual(['https://images.example.test']);
    expect(directive(buildCsp({ imgHosts: ['https://images.example.test'] }), 'img-src')).toContain('https://images.example.test');
  });
  it('next.config sets the header on every route', async () => {
    vi.stubEnv('CSP_IMG_HOSTS', '');
    const config = (await import('./next.config')).default;
    const rules = await config.headers?.();
    expect(rules?.[0].source).toBe('/:path*');
    const csp = rules?.[0].headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(directive(csp, 'img-src')).toContain('https://tile.openstreetmap.org');
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
  });
  it('the confirmation page is private: no referrer and no cache (workstream P)', async () => {
    const config = (await import('./next.config')).default;
    const rules = await config.headers?.();
    const rule = rules?.find((r) => r.source.includes('/checkout/confirmation'));
    expect(rule?.headers).toEqual(expect.arrayContaining([{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'private, no-store' }]));
  });
});
