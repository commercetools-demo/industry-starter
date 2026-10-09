import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeReview { id: string; rating: number; title?: string; text?: string; authorName?: string; createdAt: string; includedInStatistics: boolean; target: { id: string }; custom?: { fields: { verifiedPatient?: boolean } } }

const state = { reviews: [] as FakeReview[], projection: null as unknown, lastWhere: '' };

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    reviews: () => ({
      get: (a: { queryArgs: { where: string; sort: string; limit: number } }) => ({
        execute: async () => {
          state.lastWhere = a.queryArgs.where;
          const id = /id="([^"]+)"/.exec(a.queryArgs.where)?.[1];
          // the fake applies the platform-side filters the predicate asks for, so the code's own filter is a second line of defence
          const results = state.reviews.filter((r) => r.target.id === id && r.includedInStatistics).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
          return { body: { results: results.slice(0, a.queryArgs.limit) } };
        },
      }),
    }),
    productProjections: () => ({
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            if (ID === 'missing') throw Object.assign(new Error('nf'), { statusCode: 404 });
            return { body: state.projection };
          },
        }),
      }),
    }),
  },
}));

import { getRatingStatistics, listVerifiedReviews } from '@/lib/ct/reviews';

const rev = (id: string, createdAt: string, verified: boolean | undefined, o: Partial<FakeReview> = {}): FakeReview => ({
  id, rating: 5, createdAt, includedInStatistics: true, target: { id: 'prod-1' }, ...(verified === undefined ? {} : { custom: { fields: { verifiedPatient: verified } } }), ...o,
});

describe('reviews', () => {
  beforeEach(() => {
    state.reviews = [];
    state.lastWhere = '';
    state.projection = null;
  });

  it('lists only verified reviews, newest first, and asks the platform for the verified flag', async () => {
    state.reviews = [rev('a', '2026-01-01', true, { rating: 4, text: 'Clear advice' }), rev('b', '2026-02-01', false), rev('c', '2026-03-01', undefined), rev('d', '2026-04-01', true, { authorName: 'Pat' })];
    const out = await listVerifiedReviews('prod-1');
    expect(out.map((r) => r.id)).toEqual(['d', 'a']);
    expect(out[1]).toEqual({ id: 'a', rating: 4, text: 'Clear advice', createdAt: '2026-01-01' });
    expect(state.lastWhere).toContain('custom(fields(verifiedPatient=true))');
    expect(state.lastWhere).toContain('includedInStatistics=true');
  });

  it('does not return reviews of other products', async () => {
    state.reviews = [rev('x', '2026-01-01', true, { target: { id: 'prod-2' } })];
    expect(await listVerifiedReviews('prod-1')).toEqual([]);
  });

  it('a product id with predicate characters is rejected without a query', async () => {
    state.reviews = [rev('a', '2026-01-01', true)];
    expect(await listVerifiedReviews('prod-1" or 1=1 or id="')).toEqual([]);
    expect(state.lastWhere).toBe('');
  });

  it('reads rating statistics from the product projection', async () => {
    state.projection = { reviewRatingStatistics: { averageRating: 4.8, count: 5, highestRating: 5, lowestRating: 4, ratingsDistribution: { '5': 4, '4': 1 } } };
    expect(await getRatingStatistics('prod-1')).toEqual({ averageRating: 4.8, count: 5, ratingsDistribution: { '5': 4, '4': 1 } });
  });

  it('no statistics (no reviews) and unknown product both give null', async () => {
    state.projection = { id: 'prod-1' };
    expect(await getRatingStatistics('prod-1')).toBeNull();
    state.projection = { reviewRatingStatistics: { averageRating: 0, count: 0, ratingsDistribution: {} } };
    expect(await getRatingStatistics('prod-1')).toBeNull();
    expect(await getRatingStatistics('missing')).toBeNull();
    expect(await getRatingStatistics('bad id!')).toBeNull();
  });
});
