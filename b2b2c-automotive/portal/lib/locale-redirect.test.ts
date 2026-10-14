/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { decideLocale } from './locale-redirect';

const decide = (pathname: string, extra: { search?: string; cookieLocale?: string; nodeEnv?: string } = {}) =>
  decideLocale({ pathname, search: extra.search ?? '', cookieLocale: extra.cookieLocale, nodeEnv: extra.nodeEnv ?? 'production' });

describe('decideLocale', () => {
  it('Bare path without cookie', () => {
    expect(decide('/')).toEqual({ kind: 'redirect', location: '/de-DE' });
  });
  it('Bare path with en-US cookie', () => {
    expect(decide('/', { cookieLocale: 'en-US' })).toEqual({ kind: 'redirect', location: '/en-US' });
  });
  it('Bare path with an unsupported cookie value', () => {
    expect(decide('/', { cookieLocale: 'fr-FR' })).toEqual({ kind: 'redirect', location: '/de-DE' });
  });
  it('Bare path keeps the query string', () => {
    expect(decide('/', { search: '?a=1' })).toEqual({ kind: 'redirect', location: '/de-DE?a=1' });
  });
  it('Path without locale is prefixed', () => {
    expect(decide('/orders')).toEqual({ kind: 'redirect', location: '/de-DE/orders' });
  });
  it('Wrong case is canonicalised', () => {
    expect(decide('/de-de/orders', { search: '?x=1' })).toEqual({ kind: 'redirect', location: '/de-DE/orders?x=1' });
    expect(decide('/EN-us')).toEqual({ kind: 'redirect', location: '/en-US' });
  });
  it('Unsupported locale passes through', () => {
    expect(decide('/fr-FR/orders')).toEqual({ kind: 'passUnsupported' });
  });
  it('Prefixed path with a different cookie asks to set the cookie', () => {
    expect(decide('/en-US', { cookieLocale: 'de-DE' })).toEqual({ kind: 'pass', locale: 'en-US', setCookie: true });
    expect(decide('/en-US', { cookieLocale: 'en-US' })).toEqual({ kind: 'pass', locale: 'en-US', setCookie: false });
    expect(decide('/de-DE/x')).toEqual({ kind: 'pass', locale: 'de-DE', setCookie: true });
  });
  it('API and static paths are skipped', () => {
    for (const p of ['/api/health', '/_next/static/a.js', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/logo.png']) {
      expect(decide(p)).toEqual({ kind: 'skip' });
    }
  });
  it('Dev path is skipped outside production', () => {
    expect(decide('/dev/tokens', { nodeEnv: 'development' })).toEqual({ kind: 'skip' });
  });
  it('Dev path is not skipped in production', () => {
    expect(decide('/dev/tokens', { nodeEnv: 'production' })).toEqual({ kind: 'redirect', location: '/de-DE/dev/tokens' });
  });
});
