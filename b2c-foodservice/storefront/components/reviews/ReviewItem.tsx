'use client';

import { useLocale, useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import Icon from '@/components/ui/Icon';
import type { ReviewView } from '@/lib/types';

/** Five stars filled up to `rating`, always with the text "{n} out of 5" for assistive technology. */
export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const t = useTranslations('reviews.item');
  return (
    <span className="inline-flex items-center gap-0.5" data-testid="review-stars">
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon key={n} name="star" size={size} fill={n <= rating ? 'currentColor' : 'none'} className={n <= rating ? 'text-ink' : 'text-line-2'} />
        ))}
      </span>
      <span className="sr-only">{t('stars', { rating })}</span>
    </span>
  );
}

/** Date in the session locale (UTC day, so the label does not move with the viewer's time zone). */
export function useReviewDate() {
  const locale = useLocale();
  return (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
  };
}

/**
 * One published review. Title, text and author are rendered as plain React text (never as HTML); line breaks are kept
 * with `white-space: pre-line`. No card border, a hairline between items.
 */
const ReviewItem = forwardRef<HTMLLIElement, { review: ReviewView }>(function ReviewItem({ review }, ref) {
  const t = useTranslations('reviews.item');
  const formatDate = useReviewDate();
  return (
    <li ref={ref} tabIndex={-1} className="border-b border-line py-5 outline-none first:pt-0 last:border-b-0" data-testid="review-item">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} />
        {review.title ? <p className="m-0 font-display text-[16px] font-semibold text-ink [overflow-wrap:anywhere]">{review.title}</p> : null}
      </div>
      <p className="mb-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
        <span>{t('by', { name: review.authorName })}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
        {review.verifiedPurchase ? (
          <span className="inline-flex items-center gap-1 rounded-pill border border-teal-strong bg-surface px-2 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-teal-text">
            <Icon name="check" size={11} />
            {t('verified')}
          </span>
        ) : null}
      </p>
      {review.text ? (
        <p className="mb-0 mt-2.5 whitespace-pre-line text-[15px] leading-[1.55] text-ink [overflow-wrap:anywhere]">{review.text}</p>
      ) : null}
    </li>
  );
});

export default ReviewItem;
