/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { resolveSiteUrl } from './site';

describe('resolveSiteUrl', () => {
  it('prefers SITE_URL over URL over localhost', () => {
    expect(resolveSiteUrl({ SITE_URL: 'https://a.example', URL: 'https://b.example' })).toBe('https://a.example');
    expect(resolveSiteUrl({ URL: 'https://b.example' })).toBe('https://b.example');
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
  it('removes trailing slashes', () => {
    expect(resolveSiteUrl({ SITE_URL: 'https://a.example//' })).toBe('https://a.example');
  });
});
