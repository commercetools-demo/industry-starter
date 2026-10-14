/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { routing } from './routing';

describe('routing', () => {
  it('Routing has two locales and always-prefix', () => {
    expect([...routing.locales]).toEqual(['de-DE', 'en-US']);
    expect(routing.defaultLocale).toBe('de-DE');
    expect(routing.localePrefix).toBe('always');
  });
  it('Locale detection is off', () => {
    expect(routing.localeDetection).toBe(false);
  });
  it('Cookie name is your-shop-country-locale', () => {
    expect(routing.localeCookie).toMatchObject({ name: 'your-shop-country-locale', path: '/', sameSite: 'lax' });
  });
});
