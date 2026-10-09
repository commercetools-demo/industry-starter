// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import proxy, { config } from './proxy';

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
}

function location(response: Response): string | null {
  const value = response.headers.get('location');
  return value ? new URL(value).pathname + new URL(value).search : null;
}

// Mirrors how Next applies `config.matcher`: a path is handled by the proxy only if a pattern matches.
function matches(path: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));
}

describe('storefront-locale-routing: Locale-prefixed routes', () => {
  it('Unprefixed request: redirects to /en-US/... without a cookie', () => {
    const response = proxy(request('/doctors/remote'));
    expect(response.status).toBe(307);
    expect(location(response)).toBe('/en-US/doctors/remote');
  });

  it('Unprefixed request: the root goes to /en-US and the query string is kept', () => {
    expect(location(proxy(request('/')))).toBe('/en-US');
    expect(location(proxy(request('/search?q=a')))).toBe('/en-US/search?q=a');
  });

  it('Unprefixed request: a short route such as /faq is not mistaken for a locale', () => {
    expect(location(proxy(request('/faq')))).toBe('/en-US/faq');
  });

  it('Unprefixed request: a valid your-shop-country-locale cookie is respected', () => {
    expect(location(proxy(request('/cart', 'your-shop-country-locale=en-US')))).toBe('/en-US/cart');
  });

  it('Unprefixed request: an invalid cookie falls back to en-US', () => {
    expect(location(proxy(request('/cart', 'your-shop-country-locale=xx-XX')))).toBe('/en-US/cart');
  });

  it('Unsupported locale in the URL: /fr-FR/x goes to the default-locale equivalent', () => {
    expect(location(proxy(request('/fr-FR/doctors/remote')))).toBe('/en-US/doctors/remote');
    expect(location(proxy(request('/fr-FR')))).toBe('/en-US');
  });

  it('a supported prefix passes through without a redirect', () => {
    const response = proxy(request('/en-US/doctors/remote'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });
});

describe('storefront-locale-routing: Excluded paths', () => {
  it('Excluded paths: /api, /_next and files with an extension are not matched by the proxy', () => {
    for (const path of ['/api/health', '/api/cart/items', '/_next/static/chunk.js', '/favicon.ico', '/robots.txt', '/images/a.png']) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('Excluded paths: page paths and the root are matched', () => {
    for (const path of ['/', '/doctors/remote', '/en-US', '/en-US/cart']) {
      expect(matches(path), path).toBe(true);
    }
  });
});
