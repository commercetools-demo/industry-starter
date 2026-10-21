'use client';

import { useState, type ReactNode } from 'react';
import ReviewList from '@/components/reviews/ReviewList';
import SortSelect from '@/components/reviews/SortSelect';
import { useReviews } from '@/hooks/useReviews';
import type { ReviewSort } from '@/lib/types';

/** The sort select and the paged list of one product (no write form). `leading` sits at the left of the sort row. */
export default function ReviewListPanel({ productId, leading }: { productId: string; leading?: ReactNode }) {
  const [sort, setSort] = useState<ReviewSort>('newest');
  const list = useReviews(productId, sort);
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
        <div>{leading}</div>
        <SortSelect value={sort} onChange={setSort} />
      </div>
      <ReviewList
        reviews={list.reviews}
        hasMore={list.hasMore}
        isLoading={list.isLoading}
        isLoadingMore={list.isLoadingMore}
        isError={list.isError}
        onLoadMore={list.loadMore}
        onRetry={() => void list.mutate()}
      />
    </div>
  );
}
