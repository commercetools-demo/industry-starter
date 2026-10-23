import type { ReviewRatingStatistics } from '@commercetools/platform-sdk';
import type { RatingStats } from '@/lib/types';

/** Undefined when statistics are absent or there are no reviews. The average is never rounded here. */
export function mapRatingStats(s: ReviewRatingStatistics | undefined): RatingStats | undefined {
  if (!s || !s.count) return undefined;
  const raw = (s.ratingsDistribution ?? {}) as Record<string, number | undefined>;
  const n = (k: string) => raw[k] ?? 0;
  return {
    average: s.averageRating,
    count: s.count,
    distribution: { 1: n('1'), 2: n('2'), 3: n('3'), 4: n('4'), 5: n('5') },
  };
}
