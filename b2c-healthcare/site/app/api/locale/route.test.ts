// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest, makeRequest } from '@/test/request';

const getValidCountryConfig = vi.fn();
const setLocale = vi.fn();
const getSession = vi.fn();
vi.mock('@/lib/ct/locale-validation', () => ({ getValidCountryConfig: () => getValidCountryConfig() }));
vi.mock('@/lib/session', () => ({ setLocale: (arg: unknown) => setLocale(arg), getSession: () => getSession() }));

import { POST } from './route';

describe('storefront-locale-routing: Locale in the session is atomic', () => {
  beforeEach(() => {
    getValidCountryConfig.mockReset().mockResolvedValue({ 'en-US': { country: 'US', currency: 'USD', language: 'en' } });
    getSession.mockReset().mockResolvedValue({});
    setLocale.mockReset().mockResolvedValue({ locale: 'en-US', country: 'US', currency: 'USD' });
  });

  it('Partial update rejected: only currency -> 400, nothing written', async () => {
    const response = await POST(makeJsonRequest('/api/locale', { currency: 'EUR' }));
    expect(response.status).toBe(400);
    expect(setLocale).not.toHaveBeenCalled();
  });

  it('Partial update rejected: invalid JSON, unsupported locale and contradicting fields', async () => {
    expect((await POST(makeRequest('/api/locale', { method: 'POST', body: 'nope' }))).status).toBe(400);
    expect((await POST(makeJsonRequest('/api/locale', { locale: 'fr-FR' }))).status).toBe(400);
    expect((await POST(makeJsonRequest('/api/locale', { locale: 'en-US', currency: 'EUR' }))).status).toBe(400);
    expect(setLocale).not.toHaveBeenCalled();
  });

  it('Partial update rejected: locale alone is completed from COUNTRY_CONFIG', async () => {
    const response = await POST(makeJsonRequest('/api/locale', { locale: 'en-US' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locale: 'en-US', country: 'US', currency: 'USD', cartCleared: false });
    expect(setLocale).toHaveBeenCalledExactlyOnceWith({ locale: 'en-US' });
  });

  it('region excluded by project settings is refused', async () => {
    getValidCountryConfig.mockResolvedValue({});
    expect((await POST(makeJsonRequest('/api/locale', { locale: 'en-US' }))).status).toBe(400);
  });
});
