/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getPathname, routing } from './routing';

describe('routing', () => {
  it('declares both locales, en-US default and an always-present prefix', () => {
    expect(routing.locales).toEqual(['en-US', 'de-DE']);
    expect(routing.defaultLocale).toBe('en-US');
    expect(routing.localePrefix).toBe('always');
  });
  it('getPathname prefixes the locale', () => {
    expect(getPathname({ locale: 'de-DE', href: '/shop/cable' })).toBe('/de-DE/shop/cable');
  });
});
