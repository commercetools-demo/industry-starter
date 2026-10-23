import { useTranslations } from 'next-intl';
import Icon, { type IconName } from '@/components/ui/Icon';
import type { PromiseFigures } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * Three promise items under the hero buttons. Every figure comes from `getPromiseFigures` (the same source as the promise
 * bar); an item whose figure is missing is dropped. `collection` is false in a market without stores (Canada, D-035).
 */
export default function PromiseRow({
  figures,
  locale,
  collection,
}: {
  figures: PromiseFigures;
  locale: string;
  collection: boolean;
}) {
  const t = useTranslations('home.promise');
  const items: Array<{ icon: IconName; text: string }> = [];
  if (figures.freeShippingThreshold) {
    const { centAmount, currencyCode } = figures.freeShippingThreshold;
    items.push({ icon: 'truck', text: t('shipping', { threshold: formatMoney(centAmount, currencyCode, locale) }) });
  }
  if (collection && figures.collectionMinutes !== null) {
    items.push({ icon: 'store', text: t('collect', { minutes: figures.collectionMinutes }) });
  }
  if (figures.returnDays > 0) items.push({ icon: 'repeat', text: t('returns', { days: figures.returnDays }) });
  if (items.length === 0) return null;
  return (
    <ul aria-label={t('aria')} className="m-0 mt-8 flex list-none flex-wrap gap-x-6 gap-y-3 p-0">
      {items.map((item) => (
        <li key={item.icon} className="flex items-center gap-2.5 text-[13.5px] font-medium text-ink-2">
          <Icon name={item.icon} size={20} className="shrink-0 text-accent" />
          {item.text}
        </li>
      ))}
    </ul>
  );
}
