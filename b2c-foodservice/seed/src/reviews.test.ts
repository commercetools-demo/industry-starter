// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Res } from './api';
import { K } from './data/base';
import { CUSTOMERS } from './data/customers';
import { PRODUCTS, REVIEW_COUNTS } from './data/products';
import { REVIEWS, expectedStats, reviewDrafts, reviewKey } from './data/reviews';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { runSeed } from './seed';
import { verifySeed } from './verify';

const quiet = () => undefined;
const seeded = async (): Promise<FakeApi> => {
  const api = new FakeApi();
  await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
  return api;
};
const product = async (api: FakeApi, key: string): Promise<Res> => (await api.getByKey('products', key)) as Res;
const stats = (p: Res) => p.reviewRatingStatistics as { count: number; averageRating: number } | undefined;
const display = (avg: number): number => Math.round(avg * 10) / 10;

/** The listing query of the storefront: reviews of a product that are included in statistics, sorted. */
const listReviews = async (api: FakeApi, productId: string, sort: 'newest' | 'highest' | 'lowest'): Promise<Res[]> =>
  (await api.list('reviews'))
    .filter((r) => (r.target as { id: string }).id === productId && r.includedInStatistics === true)
    .sort((a, b) => (sort === 'highest' ? (b.rating as number) - (a.rating as number) : sort === 'lowest' ? (a.rating as number) - (b.rating as number) : String(b.createdAt).localeCompare(String(a.createdAt))));

/** A fresh product with the review states in place, for scenarios that need exact numbers. */
async function bare(): Promise<{ api: FakeApi; productId: string }> {
  const api = new FakeApi();
  await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' }, 'settings,tax,product-types,categories,recurrence,products,customers,review-states');
  const p = await product(api, 'mcf-p-pod-one'); // not reviewed by `bare` runs: the reviews step was not run
  return { api, productId: p.id };
}
const post = (api: FakeApi, productId: string, n: number, rating: number, state: string, customer = 'mcf-customer-maya') =>
  api.create('reviews', { key: `t-${n}`, uniquenessValue: `${customer}:${productId}:${n}`, rating, title: `t${n}`, text: 'x', locale: 'en-US', authorName: 'T T.', target: { typeId: 'product', id: productId }, state: { typeId: 'state', key: state }, customer: { typeId: 'customer', key: customer } });

describe('Ratings come from product statistics', () => {
  it('Card rating', async () => {
    // 12 reviews, seven 5-star and five 4-star: average 4.58333, shown as 4.6 with a count of 12
    const { api, productId } = await bare();
    for (let n = 1; n <= 12; n += 1) await post(api, productId, n, n <= 7 ? 5 : 4, K.reviewApproved);
    const s = stats(await api.getById('products', productId) as Res);
    expect(s?.count).toBe(12);
    expect(s?.averageRating).toBeCloseTo(4.58333, 4);
    expect(display(s?.averageRating ?? 0)).toBe(4.6);
  });

  it('No reviews', async () => {
    const api = await seeded();
    const without = PRODUCTS.filter((p) => !REVIEW_COUNTS[p.code]);
    expect(without.length).toBeGreaterThanOrEqual(3);
    for (const def of without) expect(stats(await product(api, def.key)), def.key).toBeUndefined(); // no star row, "Be the first to review"
  });
});

describe('Listing by rating', () => {
  it('Filter', async () => {
    const api = await seeded();
    const atLeast = async (min: number) => (await Promise.all(PRODUCTS.map((p) => product(api, p.key)))).filter((p) => (stats(p)?.averageRating ?? 0) >= min).map((p) => p.key).sort();
    const expected = (min: number) => PRODUCTS.filter((p) => expectedStats(p.key).averageRating >= min).map((p) => p.key).sort();
    expect(await atLeast(4.5)).toEqual(expected(4.5));
    expect(await atLeast(4.0)).toEqual(expected(4.0));
    expect((await atLeast(4.0)).length).toBeGreaterThan(0);
    expect((await atLeast(4.5)).length).toBeLessThan((await atLeast(4.0)).length);
  });
});

describe('Review list on the detail page', () => {
  it('Sorted', async () => {
    const { api, productId } = await bare();
    for (const [n, rating] of [[1, 5], [2, 3], [3, 1]] as const) await post(api, productId, n, rating, K.reviewApproved);
    expect((await listReviews(api, productId, 'lowest'))[0]?.rating).toBe(1);
    expect((await listReviews(api, productId, 'highest'))[0]?.rating).toBe(5);
  });

  it('Unpublished review hidden', async () => {
    const { api, productId } = await bare();
    await post(api, productId, 1, 5, K.reviewApproved);
    const pending = await post(api, productId, 2, 1, K.reviewPending);
    expect(pending.includedInStatistics).toBe(false);
    expect((await listReviews(api, productId, 'newest')).map((r) => r.key)).toEqual(['t-1']);
  });
});

describe('Write a review', () => {
  it('Valid review', async () => {
    const { api, productId } = await bare();
    const r = await post(api, productId, 1, 4, K.reviewPending);
    expect((r.target as { id: string }).id).toBe(productId);
    expect((r.customer as { id: string }).id).toBe(api.all('customers').find((c) => c.key === 'mcf-customer-maya')?.id);
    expect(r.rating).toBe(4);
  });

  it('Duplicate', async () => {
    // one review per customer and product: the uniqueness value rejects a second one
    const { api, productId } = await bare();
    const once = (n: number) => api.create('reviews', { key: `d-${n}`, uniquenessValue: `mcf-customer-maya:${productId}`, rating: 4, target: { typeId: 'product', id: productId }, customer: { typeId: 'customer', key: 'mcf-customer-maya' } });
    await once(1);
    await expect(once(2)).rejects.toThrow(/DuplicateField/);
  });

  it.todo('Missing rating (storefront form validation, covered by the review form tests in the storefront workstream)');
});

describe('Moderation and states', () => {
  it('New review pending', async () => {
    const { api, productId } = await bare();
    await post(api, productId, 1, 5, K.reviewApproved);
    const before = stats(await api.getById('products', productId) as Res);
    const r = await post(api, productId, 2, 1, K.reviewPending);
    expect(((await api.getById('states', (r.state as { id: string }).id)) as Res).key).toBe(K.reviewPending);
    expect(stats(await api.getById('products', productId) as Res)).toEqual(before); // product rating unchanged
  });

  it('Approval', async () => {
    const { api, productId } = await bare();
    const r = await post(api, productId, 1, 2, K.reviewPending);
    expect(stats(await api.getById('products', productId) as Res)).toBeUndefined();
    await api.update('reviews', r, [{ action: 'setState', state: { typeId: 'state', key: K.reviewApproved } }]);
    expect(stats(await api.getById('products', productId) as Res)?.count).toBe(1);
    expect((await listReviews(api, productId, 'newest')).map((x) => x.key)).toEqual(['t-1']);
  });

  it('approved is the target of pending and carries the statistics role', async () => {
    const api = await seeded();
    const approved = (await api.getByKey('states', K.reviewApproved)) as Res;
    const pending = (await api.getByKey('states', K.reviewPending)) as Res;
    expect(approved.roles).toEqual(['ReviewIncludedInStatistics']);
    expect(pending.roles).toEqual([]);
    expect((pending.transitions as { id: string }[]).map((t) => t.id)).toEqual([approved.id]);
  });
});

describe('Own reviews in the account', () => {
  it('Edit', async () => {
    // edit the text, the review returns to the state the moderation rule requires (pending), statistics follow
    const { api, productId } = await bare();
    const r = await post(api, productId, 1, 5, K.reviewApproved);
    const edited = await api.update('reviews', r, [{ action: 'setText', text: 'Edited text' }, { action: 'setState', state: { typeId: 'state', key: K.reviewPending } }]);
    expect(edited.text).toBe('Edited text');
    expect(edited.includedInStatistics).toBe(false);
    expect(stats(await api.getById('products', productId) as Res)).toBeUndefined();
  });
});

describe('Seeded reviews', () => {
  it('Statistics match', async () => {
    const api = await seeded();
    expect(await verifySeed(api)).toEqual([]);
    for (const def of PRODUCTS) {
      const p = await product(api, def.key);
      expect(stats(p)?.count ?? 0, def.key).toBe(expectedStats(def.key).count);
    }
    // approved reviews are all counted
    const approved = api.all('reviews').filter((r) => r.includedInStatistics === true).length;
    expect(approved).toBe(REVIEWS.length);
  });

  it('seeds 3 to 12 reviews for each top product, none for the others, keyed mcf-review-<sku>-<n>', () => {
    const counts = new Map<string, number>();
    for (const r of REVIEWS) counts.set(r.productKey, (counts.get(r.productKey) ?? 0) + 1);
    for (const [, n] of counts) { expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(12); }
    expect(counts.size).toBe(Object.keys(REVIEW_COUNTS).length);
    expect(PRODUCTS.length - counts.size).toBeGreaterThanOrEqual(3);
    for (const r of REVIEWS) expect(r.key).toBe(reviewKey(r.sku, r.n));
    expect(REVIEWS[0]?.key).toMatch(/^mcf-review-mcf-[a-z0-9-]+-1$/);
    expect(new Set(REVIEWS.map((r) => r.key)).size).toBe(REVIEWS.length);
  });

  it('writes reviews in the language of the author, spreads ratings 1 to 5 and uses each demo customer at most once per product', () => {
    expect(new Set(REVIEWS.map((r) => r.locale))).toEqual(new Set(['en-US', 'en-GB', 'de-DE']));
    expect(new Set(REVIEWS.map((r) => r.rating))).toEqual(new Set([1, 2, 3, 4, 5]));
    const avg = REVIEWS.reduce((s, r) => s + r.rating, 0) / REVIEWS.length;
    expect(avg).toBeGreaterThan(3.8); // realistic skew towards the top
    expect(avg).toBeLessThan(4.7);
    for (const p of PRODUCTS) {
      const customers = REVIEWS.filter((r) => r.productKey === p.key && r.customerKey).map((r) => r.customerKey);
      expect(new Set(customers).size).toBe(customers.length);
    }
    for (const r of REVIEWS) if (r.customerKey) expect(CUSTOMERS.some((c) => c.key === r.customerKey)).toBe(true);
    for (const r of REVIEWS.filter((x) => x.locale === 'de-DE')) expect(r.text).not.toMatch(/\bthe\b/i);
  });

  it('the review drafts target the product, the customer and the approved state through the Reviews API', () => {
    const d = reviewDrafts()[0] as unknown as Record<string, unknown>;
    expect(d.target).toMatchObject({ typeId: 'product' });
    expect(d.state).toEqual({ typeId: 'state', key: K.reviewApproved });
    expect(d.uniquenessValue).toBe(d.key);
    for (const x of reviewDrafts()) {
      expect(x.title?.length ?? 0).toBeLessThanOrEqual(80);
      expect(x.text?.length ?? 0).toBeLessThanOrEqual(2000);
      expect(`${x.title}${x.text}`).not.toMatch(/<|@/);
    }
  });

  it('repairs a hand-edited review and a review moved back to pending', async () => {
    const api = await seeded();
    const r = api.all('reviews')[0] as Res;
    const pending = (await api.getByKey('states', K.reviewPending)) as Res;
    await api.update('reviews', r, [{ action: 'setRating', rating: r.rating === 1 ? 2 : 1 }, { action: 'setState', state: { typeId: 'state', id: pending.id } }]);
    expect(await verifySeed(api)).not.toEqual([]);
    const run = new Runner(false, quiet);
    await runSeed({ api, run, demoPassword: 'dummy-long-demo-password' });
    expect(run.lines).toEqual([`update review ${r.key} (setRating, setState)`]);
    expect(await verifySeed(api)).toEqual([]);
  });

  it.todo('Markup in text (escaping happens when the storefront renders; seed review texts contain no markup, asserted above)');
});
