import { useLocale, useTranslations } from 'next-intl';
import { formatMoney } from '@/lib/utils';
import type { ProductSummary } from '@/lib/types';

/** Price, "From" prefix when variants differ, struck old price when discounted, and the per-unit line. */
export default function PriceLine({ price, unit }: Pick<ProductSummary, 'price' | 'unit'>) {
  const t = useTranslations('card');
  const locale = useLocale();
  if (!price) return <p className="m-0 text-[14px] text-ink-3">{t('noPrice')}</p>;
  const fmt = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  const current = fmt(price.from);
  return (
    <div>
      <p className="m-0 flex items-baseline gap-2 text-[15px] font-semibold text-ink">
        <span>{price.fromIsRange ? t('from', { price: current }) : current}</span>
        {price.old ? (
          <s className="text-[13px] font-normal text-ink-3" title={price.discountName}>
            {fmt(price.old)}
          </s>
        ) : null}
      </p>
      {unit ? (
        <p className="m-0 text-[12px] text-ink-3">
          {t(unit.perKey === 'capsule' ? 'perCapsule' : 'per100g', { price: fmt(unit.money) })}
        </p>
      ) : null}
    </div>
  );
}
