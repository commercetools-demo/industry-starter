// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const unstable = vi.fn((fn: () => unknown, ...rest: [string[], { revalidate: number }]) => (void rest, fn));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown, keys: string[], opts: { revalidate: number }) => unstable(fn, keys, opts) }));
vi.mock('./client', () => ({ apiRoot: { get: () => ({ execute: async () => ({ body: { countries: ['US', 'DE'], currencies: ['USD', 'EUR'], languages: ['en-US', 'de-DE'] } }) }), categories: () => ({ get: () => ({ execute: async () => ({ body: { results: [{ id: 'c', key: 'k', slug: { 'en-US': 's' }, name: { 'en-US': 'N' } }] } }) }) }) } }));
const { TTL, getCategoryTree, getProjectLocales } = await import('./cached');

describe('malva-data-loading › Server-side cache for stable public data only', () => {
  it('TTLs: project configuration 300 s, category tree 60 s', async () => {
    await getCategoryTree('en-US');
    expect(unstable.mock.calls.at(-1)?.[2]).toEqual({ revalidate: 60 });
    await getProjectLocales();
    expect(unstable.mock.calls.at(-1)?.[2]).toEqual({ revalidate: 300 });
    expect(TTL).toEqual({ projectConfig: 300, categoryTree: 60 });
  });
  it('Not cached: no per-visitor module uses unstable_cache', () => {
    for (const f of ['lib/session.ts', 'lib/session-core.ts', 'lib/api.ts', 'lib/ct/business-units.ts', 'lib/ct/associate.ts']) expect(readFileSync(f, 'utf8'), f).not.toContain('unstable_cache');
    const users = ['lib/ct/cached.ts', 'lib/ct/locale-validation.ts'];
    for (const f of users) expect(readFileSync(f, 'utf8')).not.toMatch(/session|customer/i);
  });
});
