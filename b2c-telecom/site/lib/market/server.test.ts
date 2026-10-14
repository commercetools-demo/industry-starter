/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { getMarket } from './server';

const state = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'malva-market' && state.value !== undefined ? { name, value: state.value } : undefined),
  }),
}));

afterEach(() => {
  state.value = undefined;
});

describe('getMarket', () => {
  it('Region switched before a cart exists: getMarket reflects the new cookie', async () => {
    expect(await getMarket()).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    state.value = 'de-DE';
    expect(await getMarket()).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });

  it('defaults to en-US without a cookie or with an unsupported value, and makes no network call', async () => {
    expect((await getMarket()).locale).toBe('en-US');
    state.value = 'fr-FR';
    expect((await getMarket()).locale).toBe('en-US');
  });
});
