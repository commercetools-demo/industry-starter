import fixture from '@/lib/mappers/__fixtures__/categories.json';
import { CATEGORY_TREE_TTL } from '@/lib/config/cache';
import { buildNavItems } from '@/lib/nav';

// "New category appears without a deploy": the category tree is a cached commercetools read (H) whose only invalidation is the TTL.
// This test gives `unstable_cache` the behaviour that matters (a value is kept for `revalidate` seconds) and changes the "project"
// under it: the new category must show in the navigation after the window and not before.

const project = vi.hoisted(() => ({ categories: [] as unknown[] }));
const store = vi.hoisted(() => new Map<string, { at: number; value: unknown }>());

vi.mock('next/cache', () => ({
  unstable_cache:
    <T>(fn: () => Promise<T>, keys: string[], options: { revalidate: number }) =>
    async (): Promise<T> => {
      const key = keys.join('|');
      const hit = store.get(key);
      if (hit && Date.now() - hit.at < options.revalidate * 1000) return hit.value as T;
      const value = await fn();
      store.set(key, { at: Date.now(), value });
      return value;
    },
}));
vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({ categories: () => ({ get: () => ({ execute: async () => ({ body: { results: project.categories, total: project.categories.length } }) }) }) }),
}));

import { getCategoryTree } from '@/lib/ct/categories';

const NEW_CATEGORY = {
  ...(fixture[0] as object),
  id: 'cat-new',
  key: 'malva-cat-new-offers',
  name: { 'en-US': 'New offers', 'de-DE': 'Neue Angebote' },
  slug: { 'en-US': 'new-offers', 'de-DE': 'neue-angebote' },
  orderHint: '0.95',
  parent: undefined,
};

const labels = async (): Promise<string[]> => buildNavItems(await getCategoryTree('en-US'), 'en-US').map((item) => item.label);

beforeEach(() => {
  store.clear();
  project.categories = [...fixture];
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T09:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('navigation refresh', () => {
  it('New category appears without a deploy: appears after the cache window', async () => {
    expect(await labels()).not.toContain('New offers');
    project.categories = [...fixture, NEW_CATEGORY];

    vi.advanceTimersByTime((CATEGORY_TREE_TTL - 1) * 1000);
    expect(await labels()).not.toContain('New offers');

    vi.advanceTimersByTime(2 * 1000);
    const after = await labels();
    expect(after).toContain('New offers');
    expect(after.at(-1)).toBe('New offers');
  });

  it('the cache window is a minute at most', () => {
    expect(CATEGORY_TREE_TTL).toBeLessThanOrEqual(60);
  });
});
