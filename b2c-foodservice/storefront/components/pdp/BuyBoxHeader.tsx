'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePdp } from '@/components/pdp/pdp-state';
import Rating from '@/components/ui/Rating';
import { effectiveUnitPrice } from '@/lib/product/price';
import type { Money } from '@/lib/types';
import { formatMoney, roundRating } from '@/lib/utils';

/**
 * Category, name, price row, rating and tagline (workstream H, 3.5). The headline is the unit price at the chosen quantity
 * (the line total is on the button); while a required choice is missing it reads "From {lowest price}"; a variant with no
 * price reads "Price on request" and never shows a list price or another currency.
 */
export default function BuyBoxHeader() {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const { data, variant, quantity } = usePdp();
  const { product } = data;
  const fmt = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);

  let headline: string;
  let old: Money | undefined;
  let discountName: string | undefined;
  let unitLine: string | undefined;

  if (variant) {
    if (!variant.price) {
      headline = t('priceOnRequest');
    } else {
      const unit = effectiveUnitPrice(variant.price, quantity);
      headline = fmt(unit);
      if (variant.price.discounted) {
        old = variant.price.value;
        discountName = variant.price.discountName;
      }
      if (variant.unit) unitLine = t(variant.unit.perKey === 'capsule' ? 'unitPrice.capsule' : 'unitPrice.100g', { amount: fmt(variant.unit.money) });
    }
  } else {
    const amounts = product.variants.flatMap((v) => (v.price ? [(v.price.discounted ?? v.price.value).centAmount] : []));
    const currency = product.variants.find((v) => v.price)?.price?.value.currencyCode;
    if (amounts.length === 0 || !currency) {
      headline = t('priceOnRequest');
    } else {
      const low = fmt({ centAmount: Math.min(...amounts), currencyCode: currency });
      headline = Math.min(...amounts) === Math.max(...amounts) ? low : t('priceFrom', { amount: low });
    }
  }

  const rating = product.rating;
  return (
    <header className="flex flex-col gap-2.5">
      <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{product.categoryName}</p>
      <h1 className="m-0 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-ink">{product.name}</h1>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="m-0 flex items-baseline gap-2 text-[22px] font-semibold text-ink" data-testid="pdp-price">
          <span>{headline}</span>
          {old ? (
            <s className="text-[15px] font-normal text-ink-3" title={discountName}>
              {fmt(old)}
            </s>
          ) : null}
        </p>
        {discountName ? <span className="text-[13px] font-medium text-teal-text">{discountName}</span> : null}
        {unitLine ? <p className="m-0 text-[13px] text-ink-3" data-testid="pdp-unit-price">{unitLine}</p> : null}
      </div>
      <a href="#reviews" className="w-fit text-ink-2 no-underline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {rating ? (
          <Rating value={roundRating(rating.average)} count={rating.count} />
        ) : (
          <span className="text-[13px] underline underline-offset-2">{t('rating.firstReview')}</span>
        )}
      </a>
      {product.tagline ? <p className="m-0 text-[15.5px] leading-relaxed text-ink-2">{product.tagline}</p> : null}
    </header>
  );
}
