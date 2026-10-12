// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Review -> ReviewItem (workstream M; V adds the portal side). Moderation (D7 of V, Q-004): reviews are published at once; the
// reseller can hide one (state `review-hidden`). Seeded reviews have no state and no store: they show in every store. A review
// written through the shop carries the custom type `malva-review` with its `storeKey` and shows in that store only.
import type { Review } from '@commercetools/platform-sdk';
import type { ReviewItem } from '@/lib/types';

export const REVIEW_HIDDEN_STATE = 'review-hidden';
export const REVIEW_PUBLISHED_STATE = 'review-published';
export const REVIEW_CUSTOM_TYPE = 'malva-review';

type Fields = Record<string, unknown> | undefined;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** `null` when the review must not show in `storeKey` (hidden, of another store, or without a rating). */
export function mapReview(review: Review, storeKey: string): ReviewItem | null {
  if (review.state?.obj?.key === REVIEW_HIDDEN_STATE) return null;
  const fields = review.custom?.fields as Fields;
  const owner = str(fields?.storeKey);
  if (owner !== undefined && owner !== storeKey) return null;
  if (typeof review.rating !== 'number' || review.rating < 1 || review.rating > 5) return null;
  const replyText = str(fields?.replyText);
  return {
    id: review.id,
    author: review.authorName?.trim() || '',
    rating: review.rating,
    title: review.title?.trim() || '',
    text: review.text?.trim() || '',
    createdAt: review.createdAt,
    ...(replyText ? { reply: { text: replyText, by: str(fields?.replyBy) } } : {}),
  };
}
