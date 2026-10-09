// @vitest-environment node
import type { ProductProjection } from '@commercetools/platform-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const searchProducts = vi.fn();
const listFreeSlots = vi.fn();
vi.mock('@/lib/ct/search', () => ({ searchProducts: (...a: unknown[]) => searchProducts(...a) }));
vi.mock('@/lib/ct/scheduling', () => ({ listFreeSlots: (...a: unknown[]) => listFreeSlots(...a) }));

import { compareDoctors, doctorPageSize, searchDoctors } from './doctors';

const NOW = new Date('2026-10-08T14:00:00.000Z'); // 10:00 in New York

function projection(slug: string, name: string, o: { rating?: number; count?: number; remote?: number; office?: number; modes?: string[]; specialty?: string } = {}): ProductProjection {
  const price = (key: string, cents: number) => ({ value: { centAmount: cents, currencyCode: 'USD', fractionDigits: 2 }, channel: { typeId: 'channel', id: key, obj: { key } } });
  return {
    id: slug,
    key: `mlv-doc-${slug}`,
    name: { 'en-US': name },
    slug: { 'en-US': slug },
    reviewRatingStatistics: o.count ? { averageRating: o.rating ?? 5, count: o.count } : undefined,
    masterVariant: {
      prices: [price('mlv-remote', o.remote ?? 3500), price('mlv-office', o.office ?? 5500)],
      attributes: [
        { name: 'specialty', value: { key: o.specialty ?? 'cardiology', label: 'Cardiology' } },
        { name: 'city', value: { key: 'austin', label: 'Austin' } },
        { name: 'modes', value: (o.modes ?? ['remote', 'office']).map((k) => ({ key: k, label: k })) },
      ],
    },
  } as unknown as ProductProjection;
}

const slot = (localDate: string, startsAt: string) => ({ startsAt, localDate, localTime: '09:00', timezone: 'America/New_York' });
const TODAY_SLOT = slot('2026-10-08', '2026-10-08T17:00:00.000Z');
const LATER_SLOT = slot('2026-10-13', '2026-10-13T13:00:00.000Z');

function respond(projections: ProductProjection[]) {
  searchProducts.mockImplementation(async (_params: unknown, map: (p: ProductProjection) => unknown) => ({
    items: projections.map(map),
    total: projections.length,
    offset: 0,
    limit: 50,
    facets: [{ name: 'specialty', buckets: [{ value: 'cardiology', count: projections.length }] }],
  }));
}

const base = { mode: 'remote' as const, locale: 'en-US', currency: 'USD', country: 'US', now: NOW };

beforeEach(() => {
  searchProducts.mockReset();
  listFreeSlots.mockReset();
  vi.stubEnv('DOCTOR_PAGE_SIZE', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('design-plp: searchDoctors', () => {
  it('filters combine: mode, specialty, city (office only) and name text go to Product Search', async () => {
    respond([projection('a', 'Dr. A')]);
    listFreeSlots.mockResolvedValue([]);
    await searchDoctors({ ...base, mode: 'office', q: ' okafor ', specialty: 'dermatology', city: 'austin' });
    const params = searchProducts.mock.calls[0][0];
    expect(params.filters).toEqual({ modes: ['office'], specialty: ['dermatology'], city: ['austin'] });
    expect(JSON.stringify(params.extraQuery)).toContain('okafor');
    await searchDoctors({ ...base, mode: 'remote', city: 'austin' });
    expect(searchProducts.mock.calls[1][0].filters).toEqual({ modes: ['remote'] });
    expect(searchProducts.mock.calls[1][0].extraQuery).toBeUndefined();
  });

  it('text that names a specialty also matches that specialty', async () => {
    respond([]);
    await searchDoctors({ ...base, q: 'derm' });
    expect(JSON.stringify(searchProducts.mock.calls[0][0].extraQuery)).toContain('variants.attributes.specialty.key');
  });

  it('fee is the price on the channel of the current mode', async () => {
    respond([projection('a', 'Dr. A', { remote: 3500, office: 5500 })]);
    listFreeSlots.mockResolvedValue([]);
    expect((await searchDoctors({ ...base, mode: 'remote' })).items[0].fees.remote?.centAmount).toBe(3500);
    expect((await searchDoctors({ ...base, mode: 'office' })).items[0].fees.office?.centAmount).toBe(5500);
  });

  it('availability is read for the mode, for 7 days, and a doctor without the mode is dropped', async () => {
    respond([projection('a', 'Dr. A'), projection('b', 'Dr. B', { modes: ['remote'], office: 0 })]);
    listFreeSlots.mockResolvedValue([]);
    const result = await searchDoctors({ ...base, mode: 'office' });
    expect(result.items.map((d) => d.key)).toEqual(['mlv-doc-a']);
    expect(listFreeSlots).toHaveBeenCalledWith('mlv-doc-a', 'office', NOW, 7);
  });

  it('Available today: uses the same availability as the card (next slot is today in the clinic zone)', async () => {
    respond([projection('a', 'Dr. A'), projection('b', 'Dr. B'), projection('c', 'Dr. C')]);
    listFreeSlots.mockImplementation(async (key: string) => (key.endsWith('a') ? [LATER_SLOT] : key.endsWith('b') ? [TODAY_SLOT, LATER_SLOT] : []));
    const all = await searchDoctors(base);
    expect(all.items.map((d) => [d.name, d.next?.isToday ?? null])).toEqual([
      ['Dr. B', true],
      ['Dr. A', false],
      ['Dr. C', null],
    ]);
    const today = await searchDoctors({ ...base, today: true });
    expect(today.items.map((d) => d.name)).toEqual(['Dr. B']);
    expect(today.total).toBe(1);
    expect(today.items[0].next).toEqual(all.items[0].next);
  });

  it('a slot that is "today" on the clinic calendar counts even when it is tomorrow in UTC', async () => {
    respond([projection('a', 'Dr. A')]);
    listFreeSlots.mockResolvedValue([slot('2026-10-08', '2026-10-09T01:30:00.000Z')]);
    const result = await searchDoctors({ ...base, today: true });
    expect(result.items).toHaveLength(1);
  });

  it('default order: soonest availability, then rating, then name; no slot sorts last', () => {
    const mk = (name: string, startsAt: string | null, rating: number | null) =>
      ({ name, rating, next: startsAt ? { startsAt, localDate: '', isToday: false } : null }) as never;
    const list = [mk('Z', null, 5), mk('B', '2026-10-09T10:00:00Z', 4.5), mk('A', '2026-10-09T10:00:00Z', 4.9), mk('C', '2026-10-08T10:00:00Z', 3)];
    expect(list.sort(compareDoctors).map((d: { name: string }) => d.name)).toEqual(['C', 'A', 'B', 'Z']);
  });

  it('a schedule that cannot be read shows no badge instead of failing the list', async () => {
    respond([projection('a', 'Dr. A')]);
    listFreeSlots.mockRejectedValue(new Error('boom'));
    const result = await searchDoctors(base);
    expect(result.items[0].next).toBeNull();
  });

  it('More doctors than a page: page size 9, total counts all, facets pass through', async () => {
    respond(Array.from({ length: 20 }, (_, i) => projection(`d${String(i).padStart(2, '0')}`, `Dr. ${String(i).padStart(2, '0')}`)));
    listFreeSlots.mockResolvedValue([]);
    const first = await searchDoctors(base);
    expect(first).toMatchObject({ total: 20, page: 1, pageCount: 3, pageSize: 9 });
    expect(first.items).toHaveLength(9);
    expect(first.facets[0].name).toBe('specialty');
    expect((await searchDoctors({ ...base, page: 3 })).items).toHaveLength(2);
  });

  it('Page past the last result: the last page is returned', async () => {
    respond(Array.from({ length: 10 }, (_, i) => projection(`d${i}`, `Dr. ${i}`)));
    listFreeSlots.mockResolvedValue([]);
    const result = await searchDoctors({ ...base, page: 99 });
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('DOCTOR_PAGE_SIZE overrides the page size (invalid values fall back to 9)', () => {
    vi.stubEnv('DOCTOR_PAGE_SIZE', '3');
    expect(doctorPageSize()).toBe(3);
    vi.stubEnv('DOCTOR_PAGE_SIZE', '0');
    expect(doctorPageSize()).toBe(9);
    vi.stubEnv('DOCTOR_PAGE_SIZE', 'x');
    expect(doctorPageSize()).toBe(9);
  });

  it('search failures propagate so the page can show its error state', async () => {
    searchProducts.mockRejectedValue(new Error('search down'));
    await expect(searchDoctors(base)).rejects.toThrow('search down');
  });
});

describe('design-plp: fixture switch', () => {
  it('is never active in production', async () => {
    const { fixturesEnabled, loadFixtures } = await import('./fixtures');
    vi.stubEnv('MALVA_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect(fixturesEnabled()).toBe(false);
    expect(await loadFixtures()).toBeNull();
    vi.stubEnv('NODE_ENV', 'development');
    expect(fixturesEnabled()).toBe(true);
    expect(await loadFixtures()).not.toBeNull();
    vi.stubEnv('MALVA_FIXTURES', '');
    expect(fixturesEnabled()).toBe(false);
  });
});
