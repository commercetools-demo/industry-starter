import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Review } from '@commercetools/platform-sdk';
import { toMyReviewView, toReviewView } from '@/lib/mappers/review';

const PID = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e6f';

const h = vi.hoisted(() => {
  const state = {
    listCalls: [] as { queryArgs: Record<string, unknown> }[],
    orderCalls: [] as { queryArgs: Record<string, unknown> }[],
    posts: [] as { body: Record<string, unknown> }[],
    updates: [] as { ID: string; body: { version: number; actions: { action: string }[] } }[],
    deletes: [] as { ID: string; version: unknown }[],
    existing: [] as unknown[],
    orders: [] as unknown[],
    byId: new Map<string, unknown>(),
    postError: null as unknown,
  };
  const exec = <T,>(v: T) => ({ execute: async () => ({ body: v }) });
  const api = {
    reviews: () => ({
      get: (a: { queryArgs: Record<string, unknown> }) => {
        state.listCalls.push(a);
        return exec({ results: state.existing, total: state.existing.length });
      },
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            const v = state.byId.get(ID);
            if (!v) throw Object.assign(new Error('nf'), { statusCode: 404 });
            return { body: v };
          },
        }),
      }),
    }),
    orders: () => ({
      get: (a: { queryArgs: Record<string, unknown> }) => {
        state.orderCalls.push(a);
        return exec({ results: state.orders });
      },
    }),
    productProjections: () => ({ get: () => exec({ results: [] }) }),
  };
  const writeApi = {
    reviews: () => ({
      post: (a: { body: Record<string, unknown> }) => ({
        execute: async () => {
          if (state.postError) throw state.postError;
          state.posts.push(a);
          return { body: { id: 'rev-new', version: 1, createdAt: '2026-10-21T00:00:00.000Z', ...a.body } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        post: (a: { body: { version: number; actions: { action: string }[] } }) => {
          state.updates.push({ ID, body: a.body });
          return exec({ ...(state.byId.get(ID) as object), version: a.body.version + 1 });
        },
        delete: (a: { queryArgs: { version: unknown } }) => {
          state.deletes.push({ ID, version: a.queryArgs.version });
          return exec({});
        },
      }),
    }),
  };
  return { state, api, writeApi };
});

vi.mock('@/lib/ct/client', () => ({ apiRoot: h.api }));
vi.mock('@/lib/ct/review-client', () => ({ reviewWriteRoot: () => h.writeApi }));

import {
  AlreadyReviewedError, createReview, deleteReview, listMyReviews, listProductReviews, updateReview,
} from '@/lib/ct/reviews';

const review = (over: Partial<Review> = {}): Review =>
  ({
    id: 'r1', version: 3, createdAt: '2026-10-01T10:00:00.000Z', lastModifiedAt: '2026-10-01T10:00:00.000Z', rating: 4,
    title: 'Good', text: 'Nice', authorName: 'Maya O.', locale: 'en-US', includedInStatistics: true,
    customer: { typeId: 'customer', id: 'c1' }, target: { typeId: 'product', id: PID }, ...over,
  }) as Review;

beforeEach(() => {
  Object.assign(h.state, { listCalls: [], orderCalls: [], posts: [], updates: [], deletes: [], existing: [], orders: [], postError: null });
  h.state.byId.clear();
});

describe('reviews module', () => {
  it('Sorted', async () => {
    for (const [sort, expected] of [
      ['newest', ['createdAt desc']],
      ['highest', ['rating desc', 'createdAt desc']],
      ['lowest', ['rating asc', 'createdAt desc']],
    ] as const) {
      h.state.listCalls.length = 0;
      await listProductReviews({ productId: PID, sort, page: 0 });
      expect(h.state.listCalls[0].queryArgs.sort).toEqual(expected);
    }
  });

  it('Public list uses includedInStatistics', async () => {
    await listProductReviews({ productId: PID, sort: 'newest', page: 0 });
    expect(String(h.state.listCalls[0].queryArgs.where)).toContain('includedInStatistics=true');
  });

  it('Page offsets are page times five', async () => {
    await listProductReviews({ productId: PID, sort: 'newest', page: 3 });
    expect(h.state.listCalls[0].queryArgs).toMatchObject({ limit: 5, offset: 15, withTotal: true });
  });

  it('Product id is a variable not concatenated', async () => {
    await listProductReviews({ productId: PID, sort: 'newest', page: 0 });
    const q = h.state.listCalls[0].queryArgs;
    expect(String(q.where)).not.toContain(PID);
    expect(q['var.id']).toBe(PID);
    await expect(listProductReviews({ productId: 'x" or 1=1', sort: 'newest', page: 0 })).rejects.toMatchObject({ status: 400 });
  });

  it('own list reads by customer variable', async () => {
    await listMyReviews('c1');
    expect(h.state.listCalls[0].queryArgs).toMatchObject({ where: 'customer(id=:c)', 'var.c': 'c1', limit: 100 });
  });

  const args = { customerId: 'c1', firstName: 'Maya', lastName: 'Okonkwo', locale: 'en-US', productId: PID, input: { rating: 4 as const, text: 'Great' } };

  it('New review is published at once', async () => {
    await createReview(args);
    const body = h.state.posts[0].body;
    expect(body).not.toHaveProperty('state');
    expect(body.authorName).toBe('Maya O.');
    expect(body.rating).toBe(4);
    expect(body.target).toEqual({ typeId: 'product', id: PID });
    expect(body.customer).toEqual({ typeId: 'customer', id: 'c1' });
    expect(body.locale).toBe('en-US');
  });

  it('Created review carries no state', async () => {
    const created = await createReview(args);
    expect((created as unknown as { state?: unknown }).state).toBeUndefined();
  });

  it('Create uses uniquenessValue of customer and product', async () => {
    await createReview(args);
    expect(h.state.posts[0].body.uniquenessValue).toBe(`c1:${PID}`);
    expect(String(h.state.posts[0].body.key)).toMatch(/^rev-[0-9a-f]{8}-\d{14}$/);
  });

  it('Duplicate becomes already_reviewed', async () => {
    h.state.existing = [review({ id: 'r-old' })];
    await expect(createReview(args)).rejects.toMatchObject({ reviewId: 'r-old' });
    expect(h.state.posts).toHaveLength(0);
  });

  it('a race on uniquenessValue also becomes already_reviewed', async () => {
    h.state.postError = Object.assign(new Error('dup'), { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } });
    await expect(createReview(args)).rejects.toBeInstanceOf(AlreadyReviewedError);
  });

  it('Verified purchase is set from the orders query', async () => {
    h.state.orders = [{ id: 'o1', orderNumber: 'MCF-1001' }];
    await createReview(args);
    expect(h.state.orderCalls[0].queryArgs).toMatchObject({ where: 'customerId=:c and lineItems(productId=:p)', 'var.c': 'c1', 'var.p': PID });
    expect((h.state.posts[0].body.custom as { fields: unknown }).fields).toEqual({ verifiedPurchase: true, orderNumber: 'MCF-1001' });
  });

  it('no purchase leaves the badge off', async () => {
    await createReview(args);
    expect((h.state.posts[0].body.custom as { fields: unknown }).fields).toEqual({ verifiedPurchase: false });
  });

  it('Edit', async () => {
    h.state.byId.set('r1', review());
    await updateReview('r1', 'c1', { rating: 5, title: 'Good', text: 'Better' });
    const actions = h.state.updates[0].body.actions;
    expect(actions).toEqual([{ action: 'setRating', rating: 5 }, { action: 'setText', text: 'Better' }]);
    expect(h.state.updates[0].body.version).toBe(3);
    expect(actions.some((a) => /state/i.test(a.action))).toBe(false);
  });

  it('an edit that changes nothing sends nothing', async () => {
    h.state.byId.set('r1', review());
    await updateReview('r1', 'c1', { rating: 4 });
    expect(h.state.updates).toHaveLength(0);
  });

  it('Foreign review is 404 for update and delete', async () => {
    h.state.byId.set('r1', review({ customer: { typeId: 'customer', id: 'someone-else' } }));
    await expect(updateReview('r1', 'c1', { rating: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteReview('r1', 'c1')).rejects.toMatchObject({ status: 404 });
    await expect(deleteReview('unknown', 'c1')).rejects.toMatchObject({ status: 404 });
    expect(h.state.updates).toHaveLength(0);
    expect(h.state.deletes).toHaveLength(0);
  });

  it('Delete sends the read version', async () => {
    h.state.byId.set('r1', review());
    await deleteReview('r1', 'c1');
    expect(h.state.deletes).toEqual([{ ID: 'r1', version: 3 }]);
  });
});

describe('review mappers', () => {
  it('Mapper has no email and no customer id fields', () => {
    expect(Object.keys(toReviewView(review())).sort()).toEqual(
      ['authorName', 'createdAt', 'id', 'locale', 'rating', 'text', 'title', 'verifiedPurchase'],
    );
    expect(Object.keys(toMyReviewView(review(), null)).sort()).toEqual(
      ['authorName', 'createdAt', 'id', 'locale', 'product', 'rating', 'text', 'title', 'verifiedPurchase', 'version'],
    );
  });

  it('Verified purchase comes from the custom field only', () => {
    expect(toReviewView(review()).verifiedPurchase).toBe(false);
    expect(toReviewView(review({ custom: { type: { typeId: 'type', id: 't' }, fields: { verifiedPurchase: true } } })).verifiedPurchase).toBe(true);
  });

  it('my review carries a thumbnail image url', () => {
    const v = toMyReviewView(review(), { id: PID, name: 'Ember', slug: 'ember', sku: 'S1', imageUrl: 'https://img.example.com/a.jpg' });
    expect(v.product?.imageUrl).toContain('w=160');
  });
});
