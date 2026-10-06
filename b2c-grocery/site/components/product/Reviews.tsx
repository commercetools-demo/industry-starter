import { useLocale, useTranslations } from 'next-intl';
import type { Product } from '@/lib/types';

const STARS = [5, 4, 3, 2, 1];

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/**
 * Review summary and cards. Reviews are static placeholder data in v1 (D-039): without `product.reviews` this returns
 * `null`, so there is no heading and no gap.
 */
export function Reviews({ product }: { product: Pick<Product, 'reviews'> }) {
  const t = useTranslations('pdp.reviews');
  const locale = useLocale();
  const reviews = product.reviews;
  if (!reviews) return null;
  const peak = Math.max(1, ...reviews.distribution);
  return (
    <section aria-labelledby="pdp-reviews-title" className="mt-(--space-8)">
      <h2 id="pdp-reviews-title" className="sr-only">
        {t('title')}
      </h2>
      <div className="flex flex-wrap items-center gap-(--space-6)">
        <div>
          <div className="font-heading text-[56px] leading-none">{new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(reviews.average)}</div>
          <div className="text-[14px] text-muted">{t('count', { count: reviews.count })}</div>
        </div>
        <ul className="m-0 grid min-w-[220px] flex-1 list-none gap-(--space-1) p-0">
          {STARS.map((stars) => {
            const value = reviews.distribution[stars - 1] ?? 0;
            return (
              <li key={stars} className="flex items-center gap-(--space-2) text-[13px]">
                <span className="w-[56px] text-muted">{t('stars', { stars })}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(value / peak) * 100}%` }} />
                </span>
                <span className="w-6 text-right text-muted">{value}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="m-0 mt-(--space-5) grid list-none gap-(--space-4) p-0 tablet:grid-cols-2 desktop:grid-cols-3">
        {reviews.items.map((review) => (
          <li key={review.id} className="rounded-lg border border-divider p-(--space-4)">
            <div className="flex items-center gap-(--space-3)">
              <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-full bg-accent-2-100 text-[14px]">
                {initialsOf(review.author)}
              </span>
              <div>
                <div className="text-[15px]">{review.author}</div>
                {review.meta ? <div className="text-[13px] text-muted">{review.meta}</div> : null}
              </div>
            </div>
            <p className="mt-(--space-3) mb-(--space-1) text-[13px] text-muted">{t('rated', { rating: review.rating })}</p>
            <h3 className="m-0 text-[18px]">{review.title}</h3>
            <p className="mt-(--space-2) mb-0 text-[15px] leading-[1.6]">{review.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
