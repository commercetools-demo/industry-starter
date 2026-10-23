'use client';

import type { ReactNode } from 'react';
import ReviewList from '@/components/reviews/ReviewList';
import SortSelect from '@/components/reviews/SortSelect';
import type { useReviews } from '@/hooks/useReviews';
import type { ReviewSort } from '@/lib/types';

/**
 * The sort row and the paged list. Controlled: the section owns the sort and the `useReviews` result, because the same
 * result also tells it which review is the customer's own. `leading` sits at the left of the sort row.
 */
export default function ReviewListPanel({
  list,
  sort,
  onSortChange,
  leading,
}: {
  list: ReturnType<typeof useReviews>;
  sort: ReviewSort;
  onSortChange: (sort: ReviewSort) => void;
  leading?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
        <div>{leading}</div>
        <SortSelect value={sort} onChange={onSortChange} />
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
