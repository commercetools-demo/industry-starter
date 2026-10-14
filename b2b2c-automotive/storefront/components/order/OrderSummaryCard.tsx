// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import type { Money, OrderView } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

const ROW = 'flex justify-between gap-3';

/**
 * The lines (image, brand, name, quantity, line total, a delivery chip on subscription lines) and the totals: subtotal, each saving as its
 * own named line, delivery, the tax line with the label and rate of the order, total. Money, tax label and currency come from the order.
 */
export function OrderSummaryCard({ view }: { view: OrderView }) {
  const t = useTranslations('order.summary');
  const locale = useLocale();
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale, m.fractionDigits);
  const { totals } = view;
  const tax = totals.tax;
  const taxLabel = tax ? tax.label || (tax.rate === null ? t('taxPlain') : t('tax', { rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(tax.rate) })) : null;

  return (
    <section aria-labelledby="order-summary-title" className="grid content-start gap-4 rounded-md border border-border bg-surface p-5 print:border-0 print:p-0">
      <h2 id="order-summary-title" className="m-0 font-display text-lg font-semibold text-text">
        {t('title')}
      </h2>
      <ul className="m-0 grid list-none gap-3 p-0">
        {view.lines.map((line) => (
          <li key={line.id} className="grid grid-cols-[4rem_1fr_auto] items-start gap-3">
            <span className="relative block aspect-square overflow-hidden rounded-sm bg-surface-subtle">
              {line.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="4rem" className="object-contain" /> : null}
            </span>
            <span className="grid min-w-0 gap-1">
              {line.brand ? <span className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{line.brand}</span> : null}
              <span className="font-display text-sm font-medium text-text">{line.name}</span>
              <span className="font-ui text-xs text-text-muted">{t('quantity', { count: line.quantity })}</span>
              {line.recurrence ? (
                <Badge tone="info" className="w-fit">
                  {t('subscription', { frequency: line.recurrence.policyName })}
                </Badge>
              ) : null}
            </span>
            <span className="font-ui text-sm font-medium text-text">{money(line.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="m-0 grid gap-2 border-t border-border pt-4 font-ui text-sm text-text">
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
          <dd className="m-0">{totals.delivery.centAmount === 0 ? t('free') : money(totals.delivery)}</dd>
        </div>
        {tax ? (
          <div className={ROW}>
            <dt>{taxLabel}</dt>
            <dd className="m-0">{money(tax.amount)}</dd>
          </div>
        ) : null}
        <div className={`${ROW} border-t border-border pt-3 font-display text-lg font-bold`}>
          <dt>{t('total')}</dt>
          <dd className="m-0 text-text-price">{money(totals.total)}</dd>
        </div>
      </dl>
      {totals.pricesIncludeTax ? <p className="m-0 font-ui text-xs text-text-subtle">{t('taxIncluded')}</p> : null}
    </section>
  );
}
