import { describe, expect, it } from 'vitest';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import { matchesQuery, normalise, searchStores } from '@/lib/store-search';
import type { Store } from '@/lib/types';

const s = (name: string, city: string, postalCode: string, lat: number, lng: number): Store => ({
  id: name, key: name, name, addressLine: '', city, postalCode, country: 'US',
  hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15, geo: { lat, lng },
});
const SOHO = s('SoHo', 'New York', '10012', 40.7233, -74.003);
const BROOKLYN = s('Brooklyn', 'Brooklyn', '11201', 40.6782, -73.9442);
const ASTORIA = s('Astoria', 'Queens', '11102', 40.7644, -73.9235);
const FAR = s('Far', 'Albany', '12207', 42.65, -73.75);
const ALL = [SOHO, BROOKLYN, ASTORIA];

describe('store search', () => {
  it('normalises accents and case', () => {
    expect(normalise('  Café ')).toBe('cafe');
    expect(matchesQuery(s('Café Nord', 'Montréal', 'H2X 1Y4', 0, 0), 'montreal')).toBe(true);
    expect(matchesQuery(s('x', 'y', 'H2X 1Y4', 0, 0), 'h2x1')).toBe(true);
  });

  it('without a query or position: city then name order, no distance', () => {
    const r = searchStores(ALL, '', null);
    expect(r.rows.map((x) => x.store.name)).toEqual(['Brooklyn', 'SoHo', 'Astoria'].sort((a, b) => {
      const sa = ALL.find((x) => x.name === a)!;
      const sb = ALL.find((x) => x.name === b)!;
      return sa.city.localeCompare(sb.city) || sa.name.localeCompare(sb.name);
    }));
    expect(r.hasDistance).toBe(false);
    expect(r.rows.every((x) => x.km === null)).toBe(true);
    expect(r.noMatch).toBe(false);
  });

  it('a postcode prefix narrows and orders the matches without showing distance', () => {
    const r = searchStores(ALL, '11', null);
    expect(r.rows.map((x) => x.store.name).sort()).toEqual(['Astoria', 'Brooklyn']);
    expect(r.hasDistance).toBe(false);
  });

  it('with a position the rows are sorted by distance', () => {
    const r = searchStores(ALL, '', { lat: 40.76, lng: -73.93 });
    expect(r.rows[0].store.name).toBe('Astoria');
    expect(r.rows[0].km).toBeLessThan(2);
    expect(r.hasDistance).toBe(true);
  });

  it('no store and nothing near: no match', () => {
    expect(searchStores(ALL, 'zzz', null).noMatch).toBe(true);
    expect(searchStores([FAR], '', { lat: 40.7, lng: -74 }).noMatch).toBe(true);
    expect(searchStores([], '', null).noMatch).toBe(false);
  });
});
