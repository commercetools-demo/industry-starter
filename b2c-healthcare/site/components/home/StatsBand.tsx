import { useFormatter, useTranslations } from 'next-intl';
import type { HomeStats } from '@/lib/ct/home';

/**
 * Navy band of measured figures only: the doctor count, the review-weighted rating and the doctors with
 * a slot today. A figure without a source (null) is not rendered, and with none left the band is omitted, so a
 * literal such as "2M+ consultations" can never appear.
 */
export function StatsBand({ stats }: { stats: HomeStats | null }) {
  const t = useTranslations('home.stats');
  const format = useFormatter();
  if (!stats) return null;
  const figures: { key: string; value: string; label: string }[] = [];
  if (stats.doctorCount !== null) figures.push({ key: 'doctors', value: format.number(stats.doctorCount), label: t('doctors') });
  if (stats.averageRating !== null) {
    figures.push({
      key: 'rating',
      value: t('ratingValue', { rating: format.number(stats.averageRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }),
      label: t('rating'),
    });
  }
  if (stats.availableToday !== null) figures.push({ key: 'available', value: format.number(stats.availableToday), label: t('availableToday') });
  if (figures.length === 0) return null;
  return (
    <section aria-label={t('label')} className="bg-navy-700 py-16 text-text-on-brand">
      <dl className="m-0 mx-auto grid max-w-content grid-cols-[repeat(auto-fit,minmax(min(100%,11.25rem),1fr))] gap-8 px-5 text-center nav:px-8">
        {figures.map((figure) => (
          <div key={figure.key} data-stat={figure.key} className="flex flex-col-reverse">
            <dt className="font-meta text-md text-navy-100">{figure.label}</dt>
            <dd className="m-0 block font-display text-4xl font-semibold">{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
