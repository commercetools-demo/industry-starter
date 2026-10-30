import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const target = (res: Response) => res.headers.get('location')?.replace('http://localhost', '') ?? null;

describe('Proxy in instore mode (workstream R)', () => {
  beforeEach(() => vi.stubEnv('APP_MODE', 'instore'));
  afterEach(() => vi.unstubAllEnvs());

  it('proxy redirects content paths in instore mode', async () => {
    for (const p of ['/en-US/about', '/en-US/journal/x', '/en-CA/account/orders', '/en-US/faq', '/en-US/shop', '/en-US/search?q=a']) {
      const res = await proxy(req(p));
      expect(res.status, p).toBe(307);
      expect(target(res), p).toBe(p.startsWith('/en-CA') ? '/en-CA' : '/en-US');
    }
  });

  it('maps category and cart to their in-store pages and keeps the query', async () => {
    expect(target(await proxy(req('/en-US/category/pods?page=2')))).toBe('/en-US/c/pods?page=2');
    expect(target(await proxy(req('/en-US/cart')))).toBe('/en-US/bag');
  });

  it('serves the in-store routes and sets the locale header', async () => {
    for (const p of ['/en-US', '/en-US/c/pods', '/en-US/p/a/MCF-1', '/en-US/bag', '/en-US/checkout']) {
      const res = await proxy(req(p));
      expect(res.headers.get('location'), p).toBeNull();
      expect(res.headers.get('x-next-intl-locale'), p).toBe('en-US');
    }
  });
});

describe('Proxy in website mode', () => {
  beforeEach(() => vi.stubEnv('APP_MODE', 'website'));
  afterEach(() => vi.unstubAllEnvs());

  it('proxy leaves website mode alone', async () => {
    for (const p of ['/en-US/about', '/en-US/category/pods', '/en-US/cart', '/en-US/journal']) {
      const res = await proxy(req(p));
      expect(res.headers.get('location'), p).toBeNull();
    }
  });
});
