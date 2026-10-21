import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

function req(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
}

function target(res: Response): string | null {
  const loc = res.headers.get('location');
  return loc ? loc.replace('http://localhost', '') : null;
}

describe('Unknown locale', () => {
  it('Unknown locale redirects to the default locale, never nested', () => {
    const res = proxy(req('/fr-FR/coffee'));
    expect(res.status).toBe(307);
    expect(target(res)).toBe('/en-US/coffee');
  });

  it('Unknown locale redirects to the cookie locale', () => {
    const res = proxy(req('/fr-FR/coffee', 'malva-locale=en-CA'));
    expect(target(res)).toBe('/en-CA/coffee');
  });

  it('Bare path gets the cookie locale', () => {
    expect(target(proxy(req('/coffee', 'malva-locale=en-CA')))).toBe('/en-CA/coffee');
    expect(target(proxy(req('/')))).toBe('/en-US');
  });

  it('Invalid cookie falls back to en-US', () => {
    expect(target(proxy(req('/coffee', 'malva-locale=xx-XX')))).toBe('/en-US/coffee');
  });

  it('Removed locales are treated as unknown', () => {
    expect(target(proxy(req('/de-DE')))).toBe('/en-US');
    expect(target(proxy(req('/en-GB/tea')))).toBe('/en-US/tea');
  });

  it('Supported locale passes through and sets x-next-intl-locale', () => {
    for (const path of ['/en-CA', '/en-CA/anything']) {
      const res = proxy(req(path, 'malva-locale=en-US'));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-next-intl-locale')).toBe('en-CA');
    }
  });

  it('API and static paths are not redirected', () => {
    for (const path of ['/api/health', '/_next/static/a.js', '/favicon.ico', '/logo.png']) {
      const res = proxy(req(path));
      expect(res.headers.get('location'), path).toBeNull();
      expect(res.headers.get('x-next-intl-locale'), path).toBeNull();
    }
  });

  it('Query string is preserved', () => {
    expect(target(proxy(req('/coffee?roast=dark&page=2')))).toBe('/en-US/coffee?roast=dark&page=2');
    expect(target(proxy(req('/fr-FR/coffee?q=a')))).toBe('/en-US/coffee?q=a');
  });
});
