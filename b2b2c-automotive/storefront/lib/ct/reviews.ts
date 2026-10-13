// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Product reviews of the product page (workstream M; V extends this module for the portal). Reading needs `view_products`;
// creating a review needs `manage_products` (commercetools has no narrower scope), so the write path is behind
// `REVIEW_SUBMISSION_ENABLED` (see `.env.example`).
import 'server-only';
import type { ReviewDraft } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { apiRoot } from '@/lib/ct/client';
import { inStore } from '@/lib/ct/in-store';
import { mapReview, REVIEW_CUSTOM_TYPE, REVIEW_PUBLISHED_STATE } from '@/lib/mappers/review';
import { createTtlCache } from '@/lib/ttl-cache';
import type { ReviewItem } from '@/lib/types';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const LIST_LIMIT = 20;

export function reviewSubmissionEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.REVIEW_SUBMISSION_ENABLED?.trim().toLowerCase() === 'true';
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/**
 * Cache lifetime of a review list (V-15). The portal (another app) writes a reply or hides a review and cannot clear this cache, so a reply
 * shows after at most this long (per server instance). The shopper's own new review clears the lists of this instance at once.
 */
export const REVIEWS_TTL_MS = 60_000;
const reviewsCache = createTtlCache<ReviewItem[]>({ ttlMs: REVIEWS_TTL_MS, negativeTtlMs: REVIEWS_TTL_MS, now: () => Date.now() });
let generation = 0;
/** Forgets every cached list of this instance (a new review; tests). */
export function clearReviewsCache(): void {
  generation += 1;
}

/** The newest reviews of a product that show in `storeKey` (hidden ones and other stores' reviews are left out). Cached for `REVIEWS_TTL_MS`. */
export async function listReviews(productId: string, storeKey: string): Promise<ReviewItem[]> {
  if (!ID.test(productId)) return [];
  const key = `${generation}:${storeKey}:${productId}`;
  const hit = reviewsCache.get(key);
  if (hit?.value) return hit.value;
  const reviews = await readReviews(productId, storeKey);
  reviewsCache.set(key, reviews);
  return reviews;
}

async function readReviews(productId: string, storeKey: string): Promise<ReviewItem[]> {
  const { body } = await apiRoot
    .reviews()
    .get({ queryArgs: { where: `target(id="${productId}")`, sort: ['createdAt desc'], limit: 50, expand: ['state'] } })
    .execute();
  return body.results.flatMap((r) => mapReview(r, storeKey) ?? []).slice(0, LIST_LIMIT);
}

export type ReviewEligibility = 'eligible' | 'not-purchased' | 'already-reviewed';

/** A signed-in customer may review a part bought in this store, once. */
export async function getReviewEligibility(storeKey: string, customerId: string, productId: string): Promise<ReviewEligibility> {
  if (!ID.test(customerId) || !ID.test(productId)) return 'not-purchased';
  const [orders, existing] = await Promise.all([
    inStore(storeKey)
      .orders()
      .get({ queryArgs: { where: `customerId="${customerId}" and lineItems(productId="${productId}")`, limit: 1 } })
      .execute(),
    apiRoot
      .reviews()
      .get({ queryArgs: { where: `customer(id="${customerId}") and target(id="${productId}")`, limit: 1 } })
      .execute(),
  ]);
  if (existing.body.results.length > 0) return 'already-reviewed';
  return orders.body.results.length > 0 ? 'eligible' : 'not-purchased';
}

export interface NewReview {
  productId: string;
  rating: number;
  title: string;
  text: string;
  locale: string;
}

/** "Anna M." from the customer's names; never the e-mail address. */
const authorOf = (first?: string, last?: string): string => [first?.trim(), last?.trim() ? `${last.trim()[0].toUpperCase()}.` : undefined].filter(Boolean).join(' ') || 'Customer';

/**
 * Creates the review of the signed-in customer, published at once (Q-004): state `review-published` and the custom fields of
 * `malva-review` (store key) when the project has them (created by workstream V), else a plain review. Errors: 403 not purchased,
 * 409 already reviewed.
 */
export async function createReview(storeKey: string, customerId: string, input: NewReview): Promise<{ id: string }> {
  const eligibility = await getReviewEligibility(storeKey, customerId, input.productId);
  if (eligibility !== 'eligible') throw new ApiError(eligibility === 'already-reviewed' ? 409 : 403, eligibility);
  const { body: customer } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
  const plain: ReviewDraft = {
    uniquenessValue: `${customerId}:${input.productId}`,
    authorName: authorOf(customer.firstName, customer.lastName),
    title: input.title,
    text: input.text,
    rating: input.rating,
    locale: input.locale,
    target: { typeId: 'product', id: input.productId },
    customer: { typeId: 'customer', id: customerId },
  };
  const moderated: ReviewDraft = {
    ...plain,
    state: { typeId: 'state', key: REVIEW_PUBLISHED_STATE },
    custom: { type: { typeId: 'type', key: REVIEW_CUSTOM_TYPE }, fields: { storeKey } },
  };
  const isDuplicate = (error: unknown): boolean =>
    statusOf(error) === 409 || ((error as { body?: { errors?: { code?: string }[] } }).body?.errors ?? []).some((e) => e.code === 'DuplicateField');
  try {
    const { body } = await apiRoot.reviews().post({ body: moderated }).execute();
    clearReviewsCache();
    return { id: body.id };
  } catch (error) {
    if (isDuplicate(error)) throw new ApiError(409, 'already-reviewed');
    if (statusOf(error) !== 400) throw error;
  }
  // The project has no `malva-review` type or review states yet: write a plain review (shown in every store).
  try {
    const { body } = await apiRoot.reviews().post({ body: plain }).execute();
    clearReviewsCache();
    return { id: body.id };
  } catch (error) {
    if (isDuplicate(error)) throw new ApiError(409, 'already-reviewed');
    throw error;
  }
}
