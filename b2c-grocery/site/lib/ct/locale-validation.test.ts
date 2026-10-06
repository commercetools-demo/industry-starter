import { describe, it, expect, vi, beforeEach } from 'vitest';

// The wrapper is created at import time, so record its options in a plain array (mock state is reset between tests).
const cacheCalls = vi.hoisted(() => [] as { keys: string[]; options: { revalidate: number } }[]);
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keys: string[], options: { revalidate: number }) => {
    cacheCalls.push({ keys, options });
    return fn;
  },
}));

const execute = vi.fn();
vi.mock('./client', () => ({ getApiRoot: () => ({ get: () => ({ execute }) }) }));

import { getValidCountryConfig, getValidMarkets } from './locale-validation';

const project = (countries: string[], currencies: string[], languages: string[]) => ({ body: { countries, currencies, languages } });

beforeEach(() => execute.mockReset());

describe('locale validation', () => {
  it('cache wrapper: revalidate 300', () => {
    expect(cacheCalls).toHaveLength(1);
    expect(cacheCalls[0].options).toEqual({ revalidate: 300 });
  });

  it('both markets configured in the project: both are valid', async () => {
    execute.mockResolvedValue(project(['GB', 'DE', 'US'], ['EUR', 'GBP', 'USD'], ['en-GB', 'de-DE', 'en-US']));
    expect(Object.keys(await getValidCountryConfig())).toEqual(['en-US', 'de-DE']);
    expect((await getValidMarkets()).map((m) => m.locale)).toEqual(['en-US', 'de-DE']);
  });

  it('a market whose country is missing from the project is not offered', async () => {
    execute.mockResolvedValue(project(['US'], ['EUR', 'USD'], ['en-US', 'de-DE']));
    expect((await getValidMarkets()).map((m) => m.locale)).toEqual(['en-US']);
  });

  it('a market whose currency or language is missing is not offered', async () => {
    execute.mockResolvedValue(project(['US', 'DE'], ['USD'], ['en-US', 'de-DE']));
    expect((await getValidMarkets()).map((m) => m.locale)).toEqual(['en-US']);
    execute.mockResolvedValue(project(['US', 'DE'], ['USD', 'EUR'], ['en-US']));
    expect((await getValidMarkets()).map((m) => m.locale)).toEqual(['en-US']);
  });
});
