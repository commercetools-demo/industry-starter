import { describe, expect, it } from 'vitest';
import { getAppMode, instoreRedirect, isInstore, parseAppMode } from '@/lib/app-mode';

describe('App mode (workstream R)', () => {
  it('Mode defaults to website', () => {
    expect(parseAppMode(undefined)).toBe('website');
    expect(parseAppMode('')).toBe('website');
    expect(getAppMode({})).toBe('website');
    expect(isInstore({})).toBe(false);
  });

  it('instore is trimmed and case insensitive, anything else is the website', () => {
    expect(parseAppMode('instore')).toBe('instore');
    expect(parseAppMode('  InStore ')).toBe('instore');
    expect(isInstore({ APP_MODE: 'INSTORE' })).toBe(true);
    for (const v of ['in-store', 'store', 'true', '1', 'website', 'instore2']) expect(parseAppMode(v), v).toBe('website');
  });

  it('reads process.env by default', () => {
    const before = process.env.APP_MODE;
    process.env.APP_MODE = 'instore';
    expect(isInstore()).toBe(true);
    process.env.APP_MODE = 'website';
    expect(isInstore()).toBe(false);
    if (before === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = before;
  });
});

describe('In-store redirects (path after the locale)', () => {
  it('serves the home, category, product, bag and checkout routes as they are', () => {
    for (const p of ['', '/', '/c/coffee', '/p/slug/MCF-POD-EMBER-50', '/bag', '/checkout', '/checkout/confirmation/abc', '/dev/design']) {
      expect(instoreRedirect(p), p).toBeNull();
    }
  });

  it('maps the website routes that have an in-store page', () => {
    expect(instoreRedirect('/category/pods')).toBe('/c/pods');
    expect(instoreRedirect('/category/pods/original')).toBe('/c/pods/original');
    expect(instoreRedirect('/category')).toBe('/');
    expect(instoreRedirect('/cart')).toBe('/bag');
  });

  it('sends content, account, journal, search and unknown paths home', () => {
    for (const p of ['/about', '/faq', '/contact', '/journal', '/journal/a-slug', '/policies/terms', '/account', '/account/orders', '/shop', '/search', '/nope']) {
      expect(instoreRedirect(p), p).toBe('/');
    }
  });
});
