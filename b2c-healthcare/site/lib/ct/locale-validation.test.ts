// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProjectSettings = vi.fn();
vi.mock('@/lib/ct/project', () => ({ getProjectSettings: () => getProjectSettings() }));

import { getValidCountryConfig } from './locale-validation';

describe('storefront-locale-routing: Region configuration as one table', () => {
  beforeEach(() => getProjectSettings.mockReset());

  it('Region not configured in commercetools: excluded when the country is absent from the project', async () => {
    getProjectSettings.mockResolvedValue({ countries: ['DE'], currencies: ['USD'], languages: ['en-US'] });
    expect(await getValidCountryConfig()).toEqual({});
  });

  it('Region not configured in commercetools: excluded when the currency or language is absent', async () => {
    getProjectSettings.mockResolvedValue({ countries: ['US'], currencies: ['EUR'], languages: ['en-US'] });
    expect(await getValidCountryConfig()).toEqual({});
    getProjectSettings.mockResolvedValue({ countries: ['US'], currencies: ['USD'], languages: ['de'] });
    expect(await getValidCountryConfig()).toEqual({});
  });

  it('keeps a region the project enables (language tag or base language)', async () => {
    getProjectSettings.mockResolvedValue({ countries: ['US'], currencies: ['USD'], languages: ['en'] });
    expect(await getValidCountryConfig()).toEqual({ 'en-US': { country: 'US', currency: 'USD', language: 'en' } });
    getProjectSettings.mockResolvedValue({ countries: ['US'], currencies: ['USD'], languages: ['en-US'] });
    expect(Object.keys(await getValidCountryConfig())).toEqual(['en-US']);
  });
});
