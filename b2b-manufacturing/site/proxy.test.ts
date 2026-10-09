import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const req = (path: string, cookie?: string) => new NextRequest(new URL(path, 'http://localhost:3000'), cookie ? { headers: { cookie } } : undefined);
const location = (res: Response) => res.headers.get('location');

describe('malva-locale-routing › Locale-prefixed routes', () => {
  it('Unprefixed request: redirects to the default locale', () => {
    const res = proxy(req('/plumbing'));
    expect([307, 308]).toContain(res.status);
    expect(location(res)).toBe('http://localhost:3000/en-US/plumbing');
  });
  it('Unprefixed request: uses a valid locale cookie', () => {
    expect(location(proxy(req('/plumbing', 'your-shop-country-locale=de-DE')))).toBe('http://localhost:3000/de-DE/plumbing');
  });
  it('Unprefixed request: ignores an invalid cookie, and handles the root', () => {
    expect(location(proxy(req('/plumbing', 'your-shop-country-locale=fr-FR')))).toBe('http://localhost:3000/en-US/plumbing');
    expect(location(proxy(req('/')))).toBe('http://localhost:3000/en-US');
  });
  it('passes already-prefixed paths through', () => {
    expect(location(proxy(req('/de-DE/about')))).toBeNull();
  });
  it('Unsupported locale: not redirected, the layout answers with not-found', () => {
    expect(location(proxy(req('/fr-FR/plumbing')))).toBeNull();
  });
  it('Excluded paths: the matcher skips API, _next, favicon and files', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ['/api/health', '/_next/static/x.js', '/favicon.ico', '/robots.txt', '/images/a.jpg']) expect(matcher.test(p), p).toBe(false);
    for (const p of ['/plumbing', '/en-US/about']) expect(matcher.test(p), p).toBe(true);
  });
});

describe('malva-client-portal › Portal return path', () => {
  it('forwards the locale-less path and query to the portal layout', () => {
    const res = proxy(req('/de-DE/account/quotes?site=a'));
    expect(res.headers.get('x-middleware-request-x-malva-path')).toBe('/account/quotes?site=a');
  });
});
