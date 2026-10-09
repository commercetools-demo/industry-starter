import { beforeEach, describe, expect, it, vi } from 'vitest';

const cacheSpy = vi.fn();
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keys: string[], options: { revalidate: number }) => { cacheSpy(keys, options); return fn; },
}));

import { getSupportedLocales, supportedLocales } from './locale-validation';

const full = { countries: ['US', 'DE', 'GB'], currencies: ['USD', 'EUR', 'GBP'], languages: ['en-US', 'de-DE', 'en-GB'] };

describe('malva-locale-routing › Validated against the project', () => {
  beforeEach(() => cacheSpy.mockClear());
  it('serves an entry only if the project lists its country, currency and language', () => {
    expect(supportedLocales(full).map((c) => c.locale)).toEqual(['en-US', 'de-DE']);
    expect(supportedLocales({ ...full, currencies: ['USD'] }).map((c) => c.locale)).toEqual(['en-US']);
    expect(supportedLocales({ ...full, languages: ['en-US'] }).map((c) => c.locale)).toEqual(['en-US']);
    expect(supportedLocales({ countries: ['DE'], currencies: ['EUR'], languages: [] })).toEqual([]);
  });
  it('caches the result for 300 seconds', async () => {
    const read = vi.fn().mockResolvedValue(full);
    const result = await getSupportedLocales(read);
    expect(result).toHaveLength(2);
    expect(cacheSpy).toHaveBeenCalledWith(['locale-validation'], { revalidate: 300 });
  });
});
