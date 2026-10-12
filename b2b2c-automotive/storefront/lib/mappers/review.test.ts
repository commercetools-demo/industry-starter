// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Review } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapReview } from '@/lib/mappers/review';

const review = (over: Record<string, unknown> = {}): Review =>
  ({ id: 'r1', createdAt: '2026-10-01T10:00:00.000Z', authorName: 'Lena K.', title: 'Quiet', text: 'Fits well.', rating: 5, ...over }) as unknown as Review;

describe('mapReview', () => {
  it('a seeded review without state or store shows in every store', () => {
    expect(mapReview(review(), 'mau-reseller-north')).toMatchObject({ id: 'r1', author: 'Lena K.', rating: 5, title: 'Quiet', text: 'Fits well.' });
    expect(mapReview(review(), 'mau-reseller-south')).not.toBeNull();
  });
  it('a hidden review is dropped', () => {
    expect(mapReview(review({ state: { typeId: 'state', id: 's', obj: { key: 'review-hidden' } } }), 'mau-reseller-north')).toBeNull();
  });
  it('a review of another store is dropped', () => {
    const own = review({ custom: { fields: { storeKey: 'mau-reseller-north' } } });
    expect(mapReview(own, 'mau-reseller-north')).not.toBeNull();
    expect(mapReview(own, 'mau-reseller-south')).toBeNull();
  });
  it('the reply is shown under the review', () => {
    const replied = review({ custom: { fields: { storeKey: 'mau-reseller-north', replyText: 'Thank you', replyBy: 'Küstenwerk' } } });
    expect(mapReview(replied, 'mau-reseller-north')?.reply).toEqual({ text: 'Thank you', by: 'Küstenwerk' });
  });
  it('a review without a valid rating is dropped', () => {
    expect(mapReview(review({ rating: undefined }), 'mau-reseller-north')).toBeNull();
    expect(mapReview(review({ rating: 9 }), 'mau-reseller-north')).toBeNull();
  });
});
