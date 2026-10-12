// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useFormatter, useTranslations } from 'next-intl';
import { ReviewForm, type ReviewFormState } from '@/components/product/detail/ReviewForm';
import type { ReviewItem } from '@/lib/types';

export interface ProductReviewsProps {
  productId: string;
  store: string;
  storeName: string;
  /** From the product's review statistics (the same numbers as the listing's rating row). */
  rating: { average: number; count: number } | null;
  reviews: ReviewItem[];
  /** `null` hides the form (review writing is switched off). */
  form: ReviewFormState | null;
}

/** Rating summary, the newest published reviews (stars as text "4 of 5", the seller's reply under a review) and the form. */
export function ProductReviews({ productId, store, storeName, rating, reviews, form }: ProductReviewsProps) {
  const t = useTranslations('pdp');
  const format = useFormatter();
  if (!rating && reviews.length === 0 && form === null) return null;
  return (
    <section id="reviews" aria-labelledby="pdp-reviews" className="grid gap-4 rounded-md border border-border bg-surface p-5">
      <h2 id="pdp-reviews" className="m-0 font-display text-xl font-semibold text-text">
        {t('reviews')}
      </h2>
      {rating ? (
        <p className="m-0 font-ui text-sm text-text-muted">
          <span className="font-semibold text-rating">★ {rating.average.toFixed(1)}</span> · {t('reviewsSummary', { count: rating.count })}
        </p>
      ) : (
        <p className="m-0 font-ui text-sm text-text-muted">{t('noReviews')}</p>
      )}
      {reviews.length > 0 ? (
        <ul className="m-0 grid list-none gap-4 p-0">
          {reviews.map((review) => (
            <li key={review.id} className="grid gap-1 border-b border-border pb-4">
              <p className="m-0 font-ui text-sm font-semibold text-rating">
                <span aria-hidden="true">{'★'.repeat(review.rating)}</span> <span className="text-text">{t('starsText', { rating: review.rating })}</span>
              </p>
              {review.title ? <p className="m-0 font-display text-sm font-semibold text-text">{review.title}</p> : null}
              {review.text ? <p className="m-0 max-w-prose font-body text-sm text-text-body">{review.text}</p> : null}
              <p className="m-0 font-ui text-xs text-text-subtle">
                {[review.author, format.dateTime(new Date(review.createdAt), { dateStyle: 'medium' })].filter(Boolean).join(' · ')}
              </p>
              {review.reply ? (
                <div className="mt-2 rounded-sm bg-surface-subtle p-3">
                  <p className="m-0 font-ui text-xs font-bold text-text-muted">{t('replyFrom', { store: review.reply.by ?? storeName })}</p>
                  <p className="m-0 font-body text-sm text-text-body">{review.reply.text}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {form ? <ReviewForm productId={productId} state={form} store={store} /> : null}
    </section>
  );
}
