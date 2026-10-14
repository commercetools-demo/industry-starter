// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reviewsGet = vi.hoisted(() => vi.fn());
const reviewsPost = vi.hoisted(() => vi.fn());
const ordersGet = vi.hoisted(() => vi.fn());
const customerGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    reviews: () => ({ get: (a: unknown) => ({ execute: () => reviewsGet(a) }), post: (a: unknown) => ({ execute: () => reviewsPost(a) }) }),
    customers: () => ({ withId: () => ({ get: () => ({ execute: customerGet }) }) }),
    inStoreKeyWithStoreKeyValue: () => ({ orders: () => ({ get: (a: unknown) => ({ execute: () => ordersGet(a) }) }) }),
  },
  projectKey: 'p',
}));

import { clearReviewsCache, createReview, getReviewEligibility, listReviews, reviewSubmissionEnabled, REVIEWS_TTL_MS } from './reviews';

const input = { productId: 'prod1', rating: 5, title: 'Great', text: 'Fits', locale: 'en-US' };
beforeEach(() => {
  clearReviewsCache();
  for (const m of [reviewsGet, reviewsPost, ordersGet, customerGet]) m.mockReset();
  customerGet.mockResolvedValue({ body: { firstName: 'Anna', lastName: 'Meyer', email: 'anna@example.com' } });
});

describe('listReviews', () => {
  it('lists published reviews of the store and drops hidden ones', async () => {
    reviewsGet.mockResolvedValue({
      body: {
        results: [
          { id: 'a', createdAt: 't', rating: 5, authorName: 'A', state: { obj: { key: 'review-hidden' } } },
          { id: 'b', createdAt: 't', rating: 4, authorName: 'B' },
        ],
      },
    });
    expect((await listReviews('prod1', 'mau-reseller-north')).map((r) => r.id)).toEqual(['b']);
    expect(reviewsGet.mock.calls[0][0].queryArgs.where).toBe('target(id="prod1")');
  });
  it('a reply written in the portal shows after the cache lifetime, not before (V-15)', async () => {
    vi.useFakeTimers();
    try {
      const row = (replyText?: string) => ({ body: { results: [{ id: 'b', createdAt: 't', rating: 4, authorName: 'B', ...(replyText ? { custom: { fields: { replyText } } } : {}) }] } });
      reviewsGet.mockResolvedValueOnce(row());
      await listReviews('prod1', 'mau-reseller-north');
      reviewsGet.mockResolvedValue(row('Thanks'));
      await listReviews('prod1', 'mau-reseller-north');
      expect(reviewsGet).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(REVIEWS_TTL_MS + 1);
      await listReviews('prod1', 'mau-reseller-north');
      expect(reviewsGet).toHaveBeenCalledTimes(2);
      expect(REVIEWS_TTL_MS).toBeLessThanOrEqual(120_000);
    } finally {
      vi.useRealTimers();
    }
  });
  it('lists are cached per store and product', async () => {
    reviewsGet.mockResolvedValue({ body: { results: [] } });
    await listReviews('prod1', 'mau-reseller-north');
    await listReviews('prod1', 'mau-reseller-south');
    await listReviews('prod2', 'mau-reseller-north');
    expect(reviewsGet).toHaveBeenCalledTimes(3);
  });
  it('a malformed product id is not queried', async () => {
    expect(await listReviews('x" or 1=1', 'mau-reseller-north')).toEqual([]);
    expect(reviewsGet).not.toHaveBeenCalled();
  });
});

describe('getReviewEligibility', () => {
  it('no purchase is refused', async () => {
    ordersGet.mockResolvedValue({ body: { results: [] } });
    reviewsGet.mockResolvedValue({ body: { results: [] } });
    expect(await getReviewEligibility('mau-reseller-north', 'cust1', 'prod1')).toBe('not-purchased');
  });
  it('a second review by the same customer is refused', async () => {
    ordersGet.mockResolvedValue({ body: { results: [{ id: 'o' }] } });
    reviewsGet.mockResolvedValue({ body: { results: [{ id: 'r' }] } });
    expect(await getReviewEligibility('mau-reseller-north', 'cust1', 'prod1')).toBe('already-reviewed');
  });
  it('a buyer of this store who has not reviewed is eligible', async () => {
    ordersGet.mockResolvedValue({ body: { results: [{ id: 'o' }] } });
    reviewsGet.mockResolvedValue({ body: { results: [] } });
    expect(await getReviewEligibility('mau-reseller-north', 'cust1', 'prod1')).toBe('eligible');
    expect(ordersGet.mock.calls[0][0].queryArgs.where).toBe('customerId="cust1" and lineItems(productId="prod1")');
  });
});

describe('createReview', () => {
  const eligible = () => {
    ordersGet.mockResolvedValue({ body: { results: [{ id: 'o' }] } });
    reviewsGet.mockResolvedValue({ body: { results: [] } });
  };
  it('no purchase is 403 and writes nothing', async () => {
    ordersGet.mockResolvedValue({ body: { results: [] } });
    reviewsGet.mockResolvedValue({ body: { results: [] } });
    await expect(createReview('mau-reseller-north', 'cust1', input)).rejects.toMatchObject({ status: 403 });
    expect(reviewsPost).not.toHaveBeenCalled();
  });
  it('is published at once with the store key and an abbreviated author, never the e-mail', async () => {
    eligible();
    reviewsPost.mockResolvedValue({ body: { id: 'new' } });
    expect(await createReview('mau-reseller-north', 'cust1', input)).toEqual({ id: 'new' });
    const draft = reviewsPost.mock.calls[0][0].body;
    expect(draft).toMatchObject({
      uniquenessValue: 'cust1:prod1',
      authorName: 'Anna M.',
      state: { key: 'review-published' },
      custom: { fields: { storeKey: 'mau-reseller-north' } },
      target: { typeId: 'product', id: 'prod1' },
    });
    expect(JSON.stringify(draft)).not.toContain('anna@example.com');
  });
  it('falls back to a plain review when the project has no malva-review type', async () => {
    eligible();
    reviewsPost.mockRejectedValueOnce({ statusCode: 400 }).mockResolvedValueOnce({ body: { id: 'plain' } });
    expect(await createReview('mau-reseller-north', 'cust1', input)).toEqual({ id: 'plain' });
    expect(reviewsPost.mock.calls[1][0].body.custom).toBeUndefined();
  });
  it('a duplicate reported by commercetools is 409', async () => {
    eligible();
    reviewsPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } });
    await expect(createReview('mau-reseller-north', 'cust1', input)).rejects.toMatchObject({ status: 409 });
  });
});

describe('reviewSubmissionEnabled', () => {
  it('is off unless true', () => {
    expect(reviewSubmissionEnabled({})).toBe(false);
    expect(reviewSubmissionEnabled({ REVIEW_SUBMISSION_ENABLED: 'true' })).toBe(true);
  });
});
