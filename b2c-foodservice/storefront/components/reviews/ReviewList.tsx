'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import ReviewItem from '@/components/reviews/ReviewItem';
import Button from '@/components/ui/Button';
import type { ReviewView } from '@/lib/types';

export interface ReviewListProps {
  reviews: ReviewView[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  onLoadMore: () => void | Promise<void>;
  onRetry?: () => void;
}

/**
 * Five reviews per page then a ghost "Show more" (disabled with "Loading…" while fetching, hidden at the end). After more
 * load, focus moves to the first new item and a polite live region announces how many arrived.
 */
export default function ReviewList({ reviews, hasMore, isLoading, isLoadingMore, isError, onLoadMore, onRetry }: ReviewListProps) {
  const t = useTranslations('reviews');
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const waitingFrom = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const from = waitingFrom.current;
    if (from === null || reviews.length <= from) return;
    waitingFrom.current = null;
    items.current[from]?.focus();
    setAnnouncement(t('moreLoaded', { count: reviews.length - from }));
  }, [reviews.length, t]);

  if (isLoading && reviews.length === 0) {
    return <p className="m-0 py-6 text-[14px] text-ink-3" role="status">{t('loading')}</p>;
  }
  if (isError) {
    return (
      <div className="py-6" data-testid="reviews-error">
        <p className="m-0 mb-3 text-[14px] text-ink-2">{t('loadError')}</p>
        {onRetry ? <Button variant="ghost" onClick={onRetry}>{t('retry')}</Button> : null}
      </div>
    );
  }
  if (reviews.length === 0) {
    return (
      <div className="py-6" data-testid="reviews-empty">
        <p className="m-0 text-[15px] text-ink-2">{t('empty')}</p>
        <p className="m-0 mt-1 font-display text-[16px] font-semibold text-ink">{t('beFirst')}</p>
      </div>
    );
  }
  return (
    <div>
      <ul className="m-0 list-none p-0">
        {reviews.map((r, i) => (
          <ReviewItem
            key={r.id}
            review={r}
            ref={(el) => {
              items.current[i] = el;
            }}
          />
        ))}
      </ul>
      {hasMore ? (
        <div className="mt-4">
          <Button
            variant="ghost"
            disabled={isLoadingMore}
            onClick={() => {
              waitingFrom.current = reviews.length;
              void onLoadMore();
            }}
          >
            {isLoadingMore ? t('loading') : t('showMore')}
          </Button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite" role="status">{announcement}</p>
    </div>
  );
}
