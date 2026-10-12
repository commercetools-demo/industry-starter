// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { makeRequest } from '@/test/request';
import { proxy } from './proxy';

const req = (url: string, cookie?: string) => {
  const base = makeRequest(url, cookie ? { headers: { cookie } } : undefined);
  return new NextRequest(base);
};

describe('Locale routing for two locales: proxy', () => {
  it('Bare path redirects to /de-DE', () => {
    const res = proxy(req('/'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/de-DE');
  });
  it('Cookie en-US redirects to /en-US', () => {
    const res = proxy(req('/', 'your-shop-country-locale=en-US'));
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US');
  });
  it('Prefixed path sets x-next-intl-locale', () => {
    const res = proxy(req('/en-US/hartmann'));
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('en-US');
  });
  it('Prefixed path updates the cookie', () => {
    const res = proxy(req('/en-US/hartmann', 'your-shop-country-locale=de-DE'));
    expect(res.cookies.get('your-shop-country-locale')?.value).toBe('en-US');
  });
  it('Unsupported locale passes through to the layout', () => {
    const res = proxy(req('/fr-FR/hartmann'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
