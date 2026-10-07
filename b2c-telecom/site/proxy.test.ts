// @vitest-environment node
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
}

function matches(path: string) {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));
}

describe('proxy', () => {
  it('/ without a cookie redirects (307) to /en-US', () => {
    const res = proxy(req('/'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US');
  });

  it('/ with cookie malva-market=de-DE redirects to /de-DE', () => {
    const res = proxy(req('/', 'malva-market=de-DE'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/de-DE');
  });

  it('/?utm=x keeps the query string', () => {
    const res = proxy(req('/?utm=x'));
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.pathname).toBe('/en-US');
    expect(location.search).toBe('?utm=x');
  });

  it('/de-DE/shop passes through with locale headers and rewrites the cookie to de-DE', () => {
    const res = proxy(req('/de-DE/shop', 'malva-market=en-US'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('de-DE');
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/de-DE/shop');
    const cookie = res.cookies.get('malva-market');
    expect(cookie?.value).toBe('de-DE');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.maxAge).toBe(31536000);
  });

  it('a prefixed URL whose cookie already matches sets no cookie', () => {
    const res = proxy(req('/de-DE', 'malva-market=de-DE'));
    expect(res.cookies.get('malva-market')).toBeUndefined();
  });

  it('/fr-FR/x is treated as unprefixed and redirects to /en-US/fr-FR/x', () => {
    const res = proxy(req('/fr-FR/x'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US/fr-FR/x');
  });

  it('an unsupported cookie value falls back to /en-US', () => {
    const res = proxy(req('/', 'malva-market=fr-FR'));
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US');
  });

  it('/api/cart, /_next/x, /dev/tokens and /logo.png are never matched', () => {
    for (const path of ['/api/cart', '/_next/x', '/dev/tokens', '/logo.png']) {
      expect(matches(path)).toBe(false);
    }
    for (const path of ['/', '/en-US', '/de-DE/shop', '/fr-FR/x']) {
      expect(matches(path)).toBe(true);
    }
  });
});
