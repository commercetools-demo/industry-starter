// @vitest-environment node
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie: `your-shop-country-locale=${cookie}` } : {} });

describe('proxy', () => {
  it('First visit: / without cookie → 307 to /en-US', () => {
    const res = proxy(req('/'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/en-US');
  });

  it('Returning visitor: / with cookie de-DE → /de-DE', () => {
    expect(new URL(proxy(req('/', 'de-DE')).headers.get('location')!).pathname).toBe('/de-DE');
  });

  it('an invalid cookie value falls back to the default', () => {
    expect(new URL(proxy(req('/', 'xx-YY')).headers.get('location')!).pathname).toBe('/en-US');
  });

  it('prefixed paths pass through with locale and pathname request headers', () => {
    const res = proxy(req('/de-DE/shop'));
    expect(res.headers.get('location')).toBeNull();
    // NextResponse.next({ request }) exposes overridden request headers as x-middleware-request-*
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('de-DE');
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/de-DE/shop');
  });

  it('Unsupported locale: /xx-YY/page is treated as unprefixed and redirected under /en-US', () => {
    expect(new URL(proxy(req('/xx-YY/page')).headers.get('location')!).pathname).toBe('/en-US/xx-YY/page');
  });

  it('keeps the query string on redirect', () => {
    expect(new URL(proxy(req('/shop?page=2')).headers.get('location')!).search).toBe('?page=2');
  });

  it('matcher skips /api, /_next, favicon and files', () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ['/api/cart', '/_next/x', '/favicon.ico', '/logo.png']) expect(re.test(p)).toBe(false);
    expect(re.test('/shop')).toBe(true);
  });
});
