import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { MARKETS } from './market';

describe('markets', () => {
  it('MARKETS locales equal the routing locales', () => {
    expect(MARKETS.map((m) => m.locale)).toEqual([...routing.locales]);
  });

  it('pairs each locale with its currency and country', () => {
    expect(MARKETS.map((m) => [m.locale, m.currency, m.country])).toEqual([
      ['en-US', 'USD', 'US'],
      ['de-DE', 'EUR', 'DE'],
    ]);
  });
});
