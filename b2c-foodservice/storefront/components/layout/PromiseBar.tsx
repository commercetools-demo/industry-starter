import { useTranslations } from 'next-intl';
import { formatMoney } from '@/lib/utils';
import type { PromiseFigures } from '@/lib/types';

/**
 * Slim ink bar above the header. Every figure is data (shipping rate, store channel, shop config); a clause whose
 * figure is missing is dropped, never replaced by a placeholder.
 */
export default function PromiseBar({ figures, locale }: { figures: PromiseFigures; locale: string }) {
  const t = useTranslations('shell.promise');
  const clauses: string[] = [];
  if (figures.freeShippingThreshold) {
    const { centAmount, currencyCode } = figures.freeShippingThreshold;
    clauses.push(t('shipping', { threshold: formatMoney(centAmount, currencyCode, locale) }));
  }
  if (figures.collectionMinutes !== null) clauses.push(t('collection', { minutes: figures.collectionMinutes }));
  if (figures.returnDays > 0) clauses.push(t('returns', { days: figures.returnDays }));
  if (clauses.length === 0) return null;
  return (
    <div className="bg-ink px-5 py-2.5 text-center text-surface">
      <p role="note" className="m-0 text-balance text-[12.5px] font-medium tracking-[0.02em]">
        {clauses.join(' · ')}
      </p>
    </div>
  );
}
