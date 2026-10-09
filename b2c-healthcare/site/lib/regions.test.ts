// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getValidCountryConfig = vi.fn();
vi.mock('@/lib/ct/locale-validation', () => ({ getValidCountryConfig: () => getValidCountryConfig() }));

const table = vi.hoisted(() => ({ value: {} as Record<string, { country: string; currency: string; language: string }> }));
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get COUNTRY_CONFIG() {
    return table.value;
  },
}));

import { getSwitchableRegions } from './regions';

const US = { country: 'US', currency: 'USD', language: 'en' };
const DE = { country: 'DE', currency: 'EUR', language: 'de' };

describe('switching-region-or-language: which regions the header offers', () => {
  beforeEach(() => {
    getValidCountryConfig.mockReset();
  });

  it('one configured region (v1): no switcher and the project is not asked', async () => {
    table.value = { 'en-US': US };
    expect(await getSwitchableRegions('en-US')).toEqual([]);
    expect(getValidCountryConfig).not.toHaveBeenCalled();
  });

  it('two configured and both valid: both are offered with a readable label', async () => {
    table.value = { 'en-US': US, 'de-DE': DE };
    getValidCountryConfig.mockResolvedValue({ 'en-US': US, 'de-DE': DE });
    expect(await getSwitchableRegions('en-US')).toEqual([
      { locale: 'en-US', label: 'United States, English (USD)' },
      { locale: 'de-DE', label: 'Germany, German (EUR)' },
    ]);
  });

  it('a region the project cannot sell is dropped; one left means no switcher', async () => {
    table.value = { 'en-US': US, 'de-DE': DE };
    getValidCountryConfig.mockResolvedValue({ 'en-US': US });
    expect(await getSwitchableRegions('en-US')).toEqual([]);
  });

  it('a failing project read hides the switcher instead of breaking the page', async () => {
    table.value = { 'en-US': US, 'de-DE': DE };
    getValidCountryConfig.mockRejectedValue(new Error('project unreachable'));
    expect(await getSwitchableRegions('en-US')).toEqual([]);
  });
});
