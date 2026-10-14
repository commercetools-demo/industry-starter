// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { CartTotals, Money } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  totals: CartTotals;
  /** Any line is a subscription: the renewal note shows. */
  hasSubscription: boolean;
  /** Locale-less address of the checkout. */
  checkoutHref: string;
  /** A line is out of stock: the button is disabled and says why. Fit never blocks (D12). */
  checkoutBlocked?: boolean;
}

const ROW = 'flex justify-between gap-3';

/**
 * Subtotal, each saving as its own named line (success tone, minus sign), delivery (Free or the fee), the tax line (label and rate from the
 * cart's tax data, "Calculated at checkout" when commercetools has not calculated tax yet), total and the Checkout button.
 */
export function OrderSummary({ totals, hasSubscription, checkoutHref, checkoutBlocked = false }: Props) {
  const t = useTranslations('cart.summary');
  const tDelivery = useTranslations('cart.delivery');
  const locale = useLocale();
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale, m.fractionDigits);
  const tax = totals.tax;
  const taxLabel = tax ? (tax.label || (tax.rate === null ? t('taxPlain') : t('tax', { rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(tax.rate) }))) : t('taxPlain');

  return (
    <aside aria-label={t('title')} className="grid content-start gap-4 rounded-md border border-border bg-surface p-5">
      <h2 className="m-0 font-display text-lg font-semibold text-text">{t('title')}</h2>
      <dl className="m-0 grid gap-2 font-ui text-sm text-text">
        <div className={ROW}>
          <dt>{t('subtotal')}</dt>
          <dd className="m-0">{money(totals.subtotal)}</dd>
        </div>
        {totals.savings.map((saving) => (
          <div key={saving.discountId} className={`${ROW} text-success-600`}>
            <dt>{saving.name}</dt>
            <dd className="m-0">−{money(saving.amount)}</dd>
          </div>
        ))}
        <div className={ROW}>
          <dt>{t('delivery')}</dt>
          <dd className="m-0">{totals.delivery.centAmount === 0 ? tDelivery('free') : money(totals.delivery)}</dd>
        </div>
        <div className={ROW}>
          <dt>{taxLabel}</dt>
          <dd className="m-0">{tax ? money(tax.amount) : t('taxPending')}</dd>
        </div>
        <div className={`${ROW} border-t border-border pt-3 font-display text-lg font-bold`}>
          <dt>{t('total')}</dt>
          <dd className="m-0 text-text-price">{money(totals.total)}</dd>
        </div>
      </dl>
      {totals.pricesIncludeTax ? <p className="m-0 font-ui text-xs text-text-subtle">{t('taxIncluded')}</p> : null}
      {hasSubscription ? <p className="m-0 font-ui text-xs text-text-muted">{t('renewalNote')}</p> : null}
      {checkoutBlocked ? (
        <>
          <button type="button" disabled className={buttonClass('primary', 'w-full')}>
            {t('checkout')}
          </button>
          <p role="alert" className="m-0 font-ui text-xs text-danger-600">
            {t('checkoutBlocked')}
          </p>
        </>
      ) : (
        <Link href={checkoutHref} className={buttonClass('primary', 'w-full')}>
          {t('checkout')}
        </Link>
      )}
    </aside>
  );
}
