// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ProductDetail } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * The price of the selected branch (D4): current price, the old price struck through and "Save {amount}" only when a Product
 * Discount applies (D3, Q-M01); "Price unavailable" without a price, never zero.
 */
export function PriceBlock({ price }: { price: ProductDetail['price'] }) {
  const t = useTranslations('pdp');
  const locale = useLocale();
  if (!price) return <p className="m-0 font-display text-lg font-medium text-text-muted">{t('priceUnavailable')}</p>;
  const money = (cent: number) => formatMoney(cent, price.currencyCode, locale, price.fractionDigits);
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="font-display text-3xl font-semibold text-text-price">{money(price.centAmount)}</span>
      {price.oldCentAmount !== undefined ? (
        <>
          <s className="font-display text-md text-text-price-old">{money(price.oldCentAmount)}</s>
          <span className="sr-only">{t('oldPrice', { price: money(price.oldCentAmount) })}</span>
          <span className="rounded-xs bg-accent-100 px-2 py-1 font-ui text-xs font-bold text-accent-800">{t('save', { amount: money(price.oldCentAmount - price.centAmount) })}</span>
        </>
      ) : null}
    </div>
  );
}
