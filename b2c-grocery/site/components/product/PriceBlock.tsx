import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@/components/ui/cx';
import { unitPrice } from '@/lib/pricing';
import type { Increment, Price } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/** Muted "€4.80 / kg" line for weighed or measured goods; renders nothing for `each` or a missing price (D-030). */
export function UnitPriceLine({ price, increment, className }: { price?: Price; increment?: Increment; className?: string }) {
  const locale = useLocale();
  const tp = useTranslations('pricing');
  const unit = increment ? unitPrice(price, increment) : null;
  if (!unit) return null;
  return (
    <span className={cx('block font-body text-[12px] leading-snug font-normal whitespace-nowrap text-muted', className)} data-testid="unit-price">
      {tp(unit.per === 'kg' ? 'perKg' : 'perL', { price: formatMoney(unit.money.centAmount, unit.money.currencyCode, locale) })}
    </span>
  );
}

/**
 * Price with `formatMoney`; a discounted price shows the original struck through.
 * With an `increment` of a weighed or measured good it adds a muted per-kg / per-litre line below.
 */
export function PriceBlock({ price, increment, className }: { price?: Price; increment?: Increment; className?: string }) {
  const locale = useLocale();
  const t = useTranslations('plp');
  if (!price) return null;
  const original = formatMoney(price.centAmount, price.currencyCode, locale);
  const main = price.discounted ? (
    <span className="inline-flex items-baseline gap-(--space-2) whitespace-nowrap">
      <span>
        <span className="sr-only">{t('now', { price: formatMoney(price.discounted.centAmount, price.discounted.currencyCode, locale) })}</span>
        <span aria-hidden="true">{formatMoney(price.discounted.centAmount, price.discounted.currencyCode, locale)}</span>
      </span>
      <del className="text-[0.8em] text-muted">
        <span className="sr-only">{t('was', { price: original })}</span>
        <span aria-hidden="true">{original}</span>
      </del>
    </span>
  ) : (
    <span className="whitespace-nowrap">{original}</span>
  );
  return (
    <span className={cx('inline-flex flex-col', className)}>
      {main}
      <UnitPriceLine price={price} increment={increment} />
    </span>
  );
}
