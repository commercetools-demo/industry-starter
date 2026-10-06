import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@/components/ui/cx';
import type { Price } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/** Price with `formatMoney`; a discounted price shows the original struck through. (N adds the unit price line.) */
export function PriceBlock({ price, className }: { price?: Price; className?: string }) {
  const locale = useLocale();
  const t = useTranslations('plp');
  if (!price) return null;
  const original = formatMoney(price.centAmount, price.currencyCode, locale);
  if (!price.discounted) return <span className={cx('whitespace-nowrap', className)}>{original}</span>;
  const current = formatMoney(price.discounted.centAmount, price.discounted.currencyCode, locale);
  return (
    <span className={cx('inline-flex items-baseline gap-(--space-2) whitespace-nowrap', className)}>
      <span>
        <span className="sr-only">{t('now', { price: current })}</span>
        <span aria-hidden="true">{current}</span>
      </span>
      <del className="text-[0.8em] text-muted">
        <span className="sr-only">{t('was', { price: original })}</span>
        <span aria-hidden="true">{original}</span>
      </del>
    </span>
  );
}
