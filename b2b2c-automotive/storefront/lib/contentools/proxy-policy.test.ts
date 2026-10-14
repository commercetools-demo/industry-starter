// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { isAllowed } from './proxy-policy';

const seg = (p: string) => p.split('/');

describe('Write through the storefront proxy: policy', () => {
  it.each([
    'service/qa-green/configuration/theme',
    'service/qa-green/published/puck-pages/home-page',
    'service/qa-green/published/puck-contents/announcement',
    'service/datasource',
    'service/datasource/cars',
    'service/products/search',
  ])('GET %s is allowed', (p) => {
    expect(isAllowed('GET', seg(p))).toBe(true);
  });

  it.each(['service/qa-green/published/puck-pages/query', 'service/qa-green/published/puck-contents/query'])('POST %s is allowed', (p) => {
    expect(isAllowed('POST', seg(p))).toBe(true);
  });

  it('Other service routes are not allowed', () => {
    for (const p of ['service/proxy-script', 'service/refresh-jwt', 'service/qa-green/configuration', 'service/qa-green/configuration/header', 'service/qa-green/puck-pages', 'service/qa-green/preview/puck-pages/query', 'service/qa-green/upload-file', 'service/qa-green/media-library', 'service/auth', 'service/qa-green/published/puck-pages', 'service/health', 'other/qa-green/configuration/theme', 'service']) {
      expect(isAllowed('GET', seg(p)), p).toBe(false);
      expect(isAllowed('POST', seg(p)), p).toBe(false);
    }
  });

  it('Every non-GET write is not allowed', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'TRACE']) {
      for (const p of ['service/qa-green/configuration/theme', 'service/qa-green/published/puck-pages/query', 'service/datasource']) expect(isAllowed(method, seg(p)), `${method} ${p}`).toBe(false);
    }
    expect(isAllowed('POST', seg('service/qa-green/configuration/theme'))).toBe(false);
    expect(isAllowed('POST', seg('service/qa-green/published/puck-pages/home-page'))).toBe(false);
    expect(isAllowed('POST', seg('service/products/search'))).toBe(false);
  });

  it('Invalid store segment is not allowed', () => {
    for (const store of ['a', '..', '.', 'a b', 'a%2Fb', 'a;b', 'x'.repeat(257), '']) {
      expect(isAllowed('GET', ['service', store, 'configuration', 'theme']), JSON.stringify(store)).toBe(false);
    }
    expect(isAllowed('GET', ['service', 'qa-green', 'published', 'puck-pages', '..'])).toBe(false);
    expect(isAllowed('GET', ['service', 'qa-green', 'published', 'puck-pages', 'a/b'])).toBe(false);
  });

  it('Method names are case-insensitive', () => {
    expect(isAllowed('get', seg('service/qa-green/configuration/theme'))).toBe(true);
    expect(isAllowed('put', seg('service/qa-green/configuration/theme'))).toBe(false);
  });
});
