// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// The throwaway second entry: adding a region is only a COUNTRY_CONFIG entry (see "Add a region" in site/README.md).
const EXTENDED = vi.hoisted(() => ({
  'en-US': { country: 'US', currency: 'USD', language: 'en' },
  'de-DE': { country: 'DE', currency: 'EUR', language: 'de' },
}));
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    COUNTRY_CONFIG: EXTENDED,
    SUPPORTED_LOCALES: Object.keys(EXTENDED),
    isSupportedLocale: (value: unknown) => typeof value === 'string' && value in EXTENDED,
  };
});

const getProjectSettings = vi.fn();
vi.mock('@/lib/ct/project', () => ({ getProjectSettings: () => getProjectSettings() }));

import enUS from '@/messages/en-US.json';
import { mergeMessages } from '@/i18n/missing-messages';
import { routing } from '@/i18n/routing';
import { getValidCountryConfig } from '@/lib/ct/locale-validation';
import { getSwitchableRegions } from '@/lib/regions';
import { withRegion } from '@/lib/session-core';
import { formatMoney } from '@/lib/utils';

describe('switching-region-or-language: adding a region is configuration', () => {
  it('one COUNTRY_CONFIG entry makes the locale routable', () => {
    expect([...routing.locales]).toEqual(['en-US', 'de-DE']);
  });

  it('the region counts only once the project lists its country, currency and language', async () => {
    getProjectSettings.mockResolvedValue({ countries: ['US'], currencies: ['USD'], languages: ['en'] });
    expect(Object.keys(await getValidCountryConfig())).toEqual(['en-US']);
    expect(await getSwitchableRegions('en-US')).toEqual([]);

    getProjectSettings.mockResolvedValue({ countries: ['US', 'DE'], currencies: ['USD', 'EUR'], languages: ['en', 'de'] });
    expect(Object.keys(await getValidCountryConfig())).toEqual(['en-US', 'de-DE']);
    expect((await getSwitchableRegions('en-US')).map((r) => r.locale)).toEqual(['en-US', 'de-DE']);
  });

  it('the session takes locale, country and currency from the entry and drops the cart on the currency change', () => {
    expect(withRegion({ cartId: 'k1', currency: 'USD', locale: 'en-US', country: 'US' }, 'de-DE')).toEqual({
      locale: 'de-DE',
      country: 'DE',
      currency: 'EUR',
    });
  });

  it('prices follow the entry currency and the locale formats them', () => {
    expect(formatMoney(1300, 'EUR', 'de-DE')).toMatch(/13,00\s€/);
  });

  it('a messages file may be partial: missing keys fall back to the default-locale text', () => {
    const merged = mergeMessages(enUS, { region: { label: 'Region und Sprache' } }) as { region: { label: string; failed: string }; shell: unknown };
    expect(merged.region.label).toBe('Region und Sprache');
    expect(merged.region.failed).toBe(enUS.region.failed);
    expect(merged.shell).toEqual(enUS.shell);
  });
});
