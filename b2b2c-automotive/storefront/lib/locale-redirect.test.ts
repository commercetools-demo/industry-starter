// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { decideLocale } from './locale-redirect';

const base = { search: '', nodeEnv: 'production' };

describe('Locale routing for two locales: decideLocale', () => {
  it('Bare path without cookie', () => {
    expect(decideLocale({ ...base, pathname: '/' })).toEqual({ kind: 'redirect', location: '/de-DE' });
  });
  it('Bare path with en-US cookie', () => {
    expect(decideLocale({ ...base, pathname: '/', cookieLocale: 'en-US' })).toEqual({ kind: 'redirect', location: '/en-US' });
  });
  it('Bare path with an unsupported cookie value', () => {
    expect(decideLocale({ ...base, pathname: '/', cookieLocale: 'fr-FR' })).toEqual({ kind: 'redirect', location: '/de-DE' });
  });
  it('Bare path keeps the query string', () => {
    expect(decideLocale({ ...base, pathname: '/', search: '?a=1', cookieLocale: 'en-US' })).toEqual({ kind: 'redirect', location: '/en-US?a=1' });
  });
  it('Path without locale is prefixed', () => {
    expect(decideLocale({ ...base, pathname: '/acme' })).toEqual({ kind: 'redirect', location: '/de-DE/acme' });
    expect(decideLocale({ ...base, pathname: '/acme/cart', search: '?x=2', cookieLocale: 'en-US' })).toEqual({ kind: 'redirect', location: '/en-US/acme/cart?x=2' });
  });
  it('Wrong case is canonicalised', () => {
    expect(decideLocale({ ...base, pathname: '/de-de/acme', search: '?q=1' })).toEqual({ kind: 'redirect', location: '/de-DE/acme?q=1' });
    expect(decideLocale({ ...base, pathname: '/EN-us' })).toEqual({ kind: 'redirect', location: '/en-US' });
  });
  it('Unsupported locale passes through', () => {
    expect(decideLocale({ ...base, pathname: '/fr-FR/acme' })).toEqual({ kind: 'passUnsupported' });
  });
  it('Supported prefixed path passes without a cookie write when the cookie matches', () => {
    expect(decideLocale({ ...base, pathname: '/de-DE/acme', cookieLocale: 'de-DE' })).toEqual({ kind: 'pass', locale: 'de-DE', setCookie: false });
  });
  it('Prefixed path with a different cookie asks to set the cookie', () => {
    expect(decideLocale({ ...base, pathname: '/en-US/acme', cookieLocale: 'de-DE' })).toEqual({ kind: 'pass', locale: 'en-US', setCookie: true });
    expect(decideLocale({ ...base, pathname: '/en-US' })).toEqual({ kind: 'pass', locale: 'en-US', setCookie: true });
  });
  it('API and static paths are skipped', () => {
    for (const pathname of ['/api/health', '/_next/static/x.js', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/logo.png']) {
      expect(decideLocale({ ...base, pathname })).toEqual({ kind: 'skip' });
    }
  });
  it('Dev path is skipped outside production', () => {
    expect(decideLocale({ ...base, nodeEnv: 'development', pathname: '/dev/tokens' })).toEqual({ kind: 'skip' });
  });
  it('Dev path is not skipped in production', () => {
    expect(decideLocale({ ...base, pathname: '/dev/tokens' })).toEqual({ kind: 'redirect', location: '/de-DE/dev/tokens' });
  });
});
