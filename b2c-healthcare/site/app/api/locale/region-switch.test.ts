// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest } from '@/test/request';
import type { SessionData } from '@/lib/session-core';

// Test-only second region: adding a region is configuration (site/README.md), so the test extends COUNTRY_CONFIG.
const TWO_REGIONS = vi.hoisted(() => ({
  'en-US': { country: 'US', currency: 'USD', language: 'en' },
  'de-DE': { country: 'DE', currency: 'EUR', language: 'de' },
}));
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  COUNTRY_CONFIG: TWO_REGIONS,
  isSupportedLocale: (value: unknown) => typeof value === 'string' && value in TWO_REGIONS,
}));
vi.mock('@/lib/ct/locale-validation', () => ({ getValidCountryConfig: async () => TWO_REGIONS }));

let stored: SessionData = {};
vi.mock('@/lib/session', async () => {
  const core = await import('@/lib/session-core');
  return {
    getSession: async () => ({ ...stored }),
    setLocale: async ({ locale }: { locale: string }) => (stored = core.withRegion(stored, locale)),
  };
});

import { POST } from './route';

const switchTo = async (locale: string) => POST(makeJsonRequest('/api/locale', { locale }));

describe('switching-region-or-language: switch flow on the server', () => {
  beforeEach(() => {
    stored = {};
  });

  it('Region switched before a cart exists: locale, currency and country change together, nothing is cleared', async () => {
    stored = { customerId: 'c-sam', locale: 'en-US', country: 'US', currency: 'USD' };
    const response = await switchTo('de-DE');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locale: 'de-DE', country: 'DE', currency: 'EUR', cartCleared: false });
    expect(stored).toEqual({ customerId: 'c-sam', locale: 'de-DE', country: 'DE', currency: 'EUR' });
  });

  it('Region switched with a cart: the cart is dropped from the session and the answer says so', async () => {
    stored = { customerId: 'c-sam', cartId: 'cart-usd', locale: 'en-US', country: 'US', currency: 'USD' };
    const body = (await (await switchTo('de-DE')).json()) as { cartCleared: boolean };
    expect(body.cartCleared).toBe(true);
    expect(stored.cartId).toBeUndefined();
    expect(stored.customerId).toBe('c-sam');
  });

  it('Region switched with a cart: choosing the current region again keeps the cart', async () => {
    stored = { customerId: 'c-sam', cartId: 'cart-usd', locale: 'en-US', country: 'US', currency: 'USD' };
    const body = (await (await switchTo('en-US')).json()) as { cartCleared: boolean };
    expect(body.cartCleared).toBe(false);
    expect(stored.cartId).toBe('cart-usd');
  });
});
