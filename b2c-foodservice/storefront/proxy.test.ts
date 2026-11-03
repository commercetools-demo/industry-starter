import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

function req(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
}

function target(res: Response): string | null {
  const loc = res.headers.get('location');
  return loc ? loc.replace('http://localhost', '') : null;
}

// The default mode is the website; the in-store mode has its own file (proxy.instore.test.ts).
beforeEach(() => vi.stubEnv('APP_MODE', 'website'));
afterEach(() => vi.unstubAllEnvs());

describe('Brand and locale redirects', () => {
  it('sends the root to the default brand in the default locale', async () => {
    const res = await proxy(req('/'));
    expect(res.status).toBe(307);
    expect(target(res)).toBe('/malva-coffee/en-US');
  });

  it('sends the root to the default brand in the cookie locale', async () => {
    expect(target(await proxy(req('/', 'malva-locale=en-CA')))).toBe('/malva-coffee/en-CA');
  });

  it('sends a legacy locale URL to the default brand with a 308, keeping path and query', async () => {
    const res = await proxy(req('/en-CA/p/some-product?x=1'));
    expect(res.status).toBe(308);
    expect(target(res)).toBe('/malva-coffee/en-CA/p/some-product?x=1');
    expect(target(await proxy(req('/en-US')))).toBe('/malva-coffee/en-US');
  });

  it('puts the brand and locale in front of a bare path', async () => {
    expect(target(await proxy(req('/coffee', 'malva-locale=en-CA')))).toBe('/malva-coffee/en-CA/coffee');
    expect(target(await proxy(req('/coffee?roast=dark&page=2')))).toBe('/malva-coffee/en-US/coffee?roast=dark&page=2');
  });

  it('keeps a brand when the locale is missing', async () => {
    expect(target(await proxy(req('/malva-drinks')))).toBe('/malva-drinks/en-US');
    expect(target(await proxy(req('/malva-drinks/c/chic', 'malva-locale=en-CA')))).toBe('/malva-drinks/en-CA/c/chic');
  });
});

describe('Unknown locale', () => {
  it('Unknown locale redirects to the default locale, never nested', async () => {
    const res = await proxy(req('/fr-FR/coffee'));
    expect(res.status).toBe(307);
    expect(target(res)).toBe('/malva-coffee/en-US/coffee');
    expect(target(await proxy(req('/malva-drinks/fr-FR/coffee')))).toBe('/malva-drinks/en-US/coffee');
  });

  it('Unknown locale redirects to the cookie locale', async () => {
    const res = await proxy(req('/fr-FR/coffee', 'malva-locale=en-CA'));
    expect(target(res)).toBe('/malva-coffee/en-CA/coffee');
  });

  it('Invalid cookie falls back to en-US', async () => {
    expect(target(await proxy(req('/coffee', 'malva-locale=xx-XX')))).toBe('/malva-coffee/en-US/coffee');
  });

  it('Removed locales are treated as unknown', async () => {
    expect(target(await proxy(req('/de-DE')))).toBe('/malva-coffee/en-US');
    expect(target(await proxy(req('/en-GB/tea')))).toBe('/malva-coffee/en-US/tea');
  });

  it('Query string is preserved', async () => {
    expect(target(await proxy(req('/fr-FR/coffee?q=a')))).toBe('/malva-coffee/en-US/coffee?q=a');
  });
});

describe('Supported brand and locale', () => {
  it('passes through and sets the locale and brand headers', async () => {
    for (const [path, brand, locale] of [
      ['/malva-coffee/en-CA', 'malva-coffee', 'en-CA'],
      ['/malva-drinks/en-CA/anything', 'malva-drinks', 'en-CA'],
      ['/malva-drinks/en-US/cart', 'malva-drinks', 'en-US'],
    ] as const) {
      const res = await proxy(req(path, 'malva-locale=en-US'));
      expect(res.headers.get('location'), path).toBeNull();
      expect(res.headers.get('x-next-intl-locale'), path).toBe(locale);
      // The brand travels as a request header (the response only echoes the locale); the request header override is on the response.
      expect(res.headers.get('x-middleware-override-headers') ?? '', path).toContain('x-brand');
      expect(res.headers.get('x-middleware-request-x-brand'), path).toBe(brand);
    }
  });

  it('API and static paths are not redirected', async () => {
    for (const path of ['/api/health', '/_next/static/a.js', '/favicon.ico', '/logo.png']) {
      const res = await proxy(req(path));
      expect(res.headers.get('location'), path).toBeNull();
      expect(res.headers.get('x-next-intl-locale'), path).toBeNull();
    }
  });
});
