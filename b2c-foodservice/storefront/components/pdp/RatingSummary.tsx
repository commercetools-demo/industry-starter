import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import type { RatingStats } from '@/lib/types';
import { roundRating } from '@/lib/utils';

/**
 * Rating summary on the product page (statistics only: the review list and the form belong to workstream M): the average,
 * the count and a 5 to 1 star distribution with a bar per row. No reviews reads "Be the first to review". The section
 * carries the `reviews` anchor the price row links to.
 */
export default function RatingSummary({ rating }: { rating: RatingStats | null }) {
  const t = useTranslations('pdp.rating');
  return (
    <section id="reviews" aria-labelledby="pdp-reviews-heading" className="scroll-mt-28 border-t border-line py-8" data-testid="rating-summary">
      <h2 id="pdp-reviews-heading" className="m-0 mb-4 font-display text-[22px] font-bold text-ink">{t('summary')}</h2>
      {rating ? (
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="flex flex-col gap-1">
            <p className="m-0 flex items-baseline gap-2">
              <span aria-hidden="true" className="font-display text-[44px] font-bold leading-none text-ink">{roundRating(rating.average).toFixed(1)}</span>
              <span className="sr-only">{t('average', { value: roundRating(rating.average).toFixed(1) })}</span>
            </p>
            <p className="m-0 text-[13px] text-ink-2">{t('count', { count: rating.count })}</p>
          </div>
          <ul className="m-0 flex min-w-[220px] flex-1 list-none flex-col gap-1.5 p-0">
            {([5, 4, 3, 2, 1] as const).map((stars) => {
              const count = rating.distribution[stars];
              const share = rating.count > 0 ? (count / rating.count) * 100 : 0;
              return (
                <li key={stars} className="flex items-center gap-3 text-[13px] text-ink-2" aria-label={t('bar', { stars, count })}>
                  <span aria-hidden="true" className="flex w-9 items-center gap-1">
                    {stars}
                    <Icon name="star" size={12} fill="currentColor" />
                  </span>
                  <span aria-hidden="true" className="relative h-2 flex-1 overflow-hidden rounded-pill bg-line-2">
                    <span className="absolute inset-y-0 left-0 rounded-pill bg-ink" style={{ width: `${share}%` }} />
                  </span>
                  <span aria-hidden="true" className="w-8 text-right font-mono text-[12px] text-ink-3">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="m-0 text-[14px] text-ink-2">{t('firstReview')}</p>
      )}
    </section>
  );
}
