// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNTRY_CONFIG } from '@/lib/utils';

const m = vi.hoisted(() => ({ getMarkets: vi.fn() }));
vi.mock('@/lib/ct/project', () => m);

import { getValidCountryConfig, validateMarket } from '@/lib/ct/market';

beforeEach(() => {
  m.getMarkets.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getValidCountryConfig', () => {
  it('Only the offered locales are listed: markets the project lacks are dropped', async () => {
    m.getMarkets.mockResolvedValue([COUNTRY_CONFIG['en-US']]);
    const options = await getValidCountryConfig();
    expect(options.map((o) => o.country)).toEqual(['US']);
    expect(options[0]).toMatchObject({ currency: 'USD', locale: 'en-US', languages: [{ locale: 'en-US', label: 'English' }] });
    expect(await validateMarket('CA')).toBeUndefined();
  });

  it('falls back to the full configuration and logs when the project call fails', async () => {
    m.getMarkets.mockRejectedValue({ statusCode: 503 });
    expect((await getValidCountryConfig()).map((o) => o.country)).toEqual(['US', 'CA']);
    expect(console.error).toHaveBeenCalled();
  });

  it('several languages for one country collapse into one option', async () => {
    m.getMarkets.mockResolvedValue([
      COUNTRY_CONFIG['en-CA'],
      { ...COUNTRY_CONFIG['en-CA'], locale: 'fr-CA' },
    ]);
    const [option] = await getValidCountryConfig();
    expect(option.languages.map((l) => l.locale)).toEqual(['en-CA', 'fr-CA']);
  });
});
