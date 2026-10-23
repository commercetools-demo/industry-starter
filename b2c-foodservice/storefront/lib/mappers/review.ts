import type { Review } from '@commercetools/platform-sdk';
import { transformThumbnailImageUrl } from '@/lib/ct/image-config';
import type { MyReviewView, ReviewView } from '@/lib/types';

const stars = (rating: number | undefined): ReviewView['rating'] => {
  const n = Math.round(rating ?? 0);
  return (n < 1 ? 1 : n > 5 ? 5 : n) as ReviewView['rating'];
};

/**
 * Public review view. Deliberately has no email, no customer id and no state: the response key list is asserted by a test.
 */
export function toReviewView(r: Review): ReviewView {
  return {
    id: r.id,
    rating: stars(r.rating),
    title: r.title?.trim() || null,
    text: r.text?.trim() || null,
    authorName: r.authorName?.trim() || 'Customer',
    createdAt: r.createdAt,
    locale: r.locale ?? null,
    verifiedPurchase: r.custom?.fields?.verifiedPurchase === true,
  };
}

export interface ReviewProductRef { id: string; name: string; slug: string; sku: string | null; imageUrl: string | null }

export function toMyReviewView(r: Review, product: ReviewProductRef | null | undefined): MyReviewView {
  return {
    ...toReviewView(r),
    version: r.version,
    product: product
      ? { ...product, imageUrl: product.imageUrl ? transformThumbnailImageUrl(product.imageUrl) : null }
      : null,
  };
}
