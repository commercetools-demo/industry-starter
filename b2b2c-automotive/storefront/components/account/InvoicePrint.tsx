// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import type { Money, OrderView } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  view: OrderView;
  store: string;
  createdAt: string;
  seller: { name: string; address: { street: string; postalCode: string; city: string } | null };
  buyer: { name: string | null; email: string | null };
}

/**
 * The printable invoice (D8): the invoice reference equals the order number; seller (store and branch address), buyer, lines, the tax of the
 * order (label and rate as the order carries them) and the total. The browser's print dialog saves it as PDF; the screen controls are hidden in print.
 */
export function InvoicePrint({ view, store, createdAt, seller, buyer }: Props) {
  const t = useTranslations('account.invoice');
  const locale = useLocale();
  const money = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale, m.fractionDigits);
  const tax = view.totals.tax;
  const taxLabel = tax ? tax.label || (tax.rate === null ? t('taxPlain') : t('tax', { rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(tax.rate) })) : null;
  return (
    <article aria-labelledby="invoice-title" className="grid gap-5 rounded-md border border-border bg-surface p-5 print:border-0 print:p-0">
      {/* The shop's header, footer and the account menu are not part of the invoice on paper. */}
      <style>{'@media print { header:not(article header), footer, nav:not(article nav) { display: none !important; } }'}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/${store}/account/orders/${view.number}`} className="inline-flex min-h-7 items-center font-utility text-sm text-text-link underline-offset-2 hover:underline">
          ← {t('back')}
        </Link>
        <Button variant="primary" onClick={() => window.print()}>
          {t('print')}
        </Button>
      </div>
      <header className="grid gap-1">
        <h1 id="invoice-title" className="m-0 font-display text-2xl font-semibold text-text">
          {t('title', { number: view.number })}
        </h1>
        <p className="m-0 font-ui text-sm text-text-muted">
          {t('reference')}: {view.number} · {t('date')}: {formatDate(createdAt, locale, view.timezone)}
        </p>
      </header>
      <div className="grid gap-5 min-[43.75rem]:grid-cols-2">
        <section aria-label={t('seller')} className="grid gap-1 font-ui text-sm text-text-body">
          <h2 className="m-0 font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('seller')}</h2>
          <span className="font-medium text-text">{seller.name}</span>
          {seller.address ? (
            <span>
              {seller.address.street}, {seller.address.postalCode} {seller.address.city}
            </span>
          ) : null}
        </section>
        <section aria-label={t('buyer')} className="grid gap-1 font-ui text-sm text-text-body">
          <h2 className="m-0 font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('buyer')}</h2>
          {buyer.name ? <span className="font-medium text-text">{buyer.name}</span> : null}
          {buyer.email ? <span>{buyer.email}</span> : null}
          {view.shipTo ? (
            <span>
              {t('shipTo')}: {view.shipTo.street}, {view.shipTo.postalCode} {view.shipTo.city}
            </span>
          ) : null}
        </section>
      </div>
      <table className="w-full border-collapse font-ui text-sm text-text-body">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th scope="col" className="py-2 pr-3 font-bold">
              {t('item')}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-bold">
              {t('quantity')}
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-bold">
              {t('amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="py-2 pr-3 text-text">{[line.brand, line.name].filter(Boolean).join(' ')}</td>
              <td className="px-3 py-2 text-right">{line.quantity}</td>
              <td className="py-2 pl-3 text-right">{money(line.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2} className="pt-3 text-right font-normal">
              {t('subtotal')}
            </th>
            <td className="pt-3 text-right">{money(view.totals.subtotal)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={2} className="text-right font-normal">
              {t('delivery')}
            </th>
            <td className="text-right">{money(view.totals.delivery)}</td>
          </tr>
          {taxLabel && tax ? (
            <tr>
              <th scope="row" colSpan={2} className="text-right font-normal">
                {taxLabel}
              </th>
              <td className="text-right">{money(tax.amount)}</td>
            </tr>
          ) : null}
          <tr className="text-md font-semibold text-text">
            <th scope="row" colSpan={2} className="pt-2 text-right">
              {t('total')}
            </th>
            <td className="pt-2 text-right">{money(view.totals.total)}</td>
          </tr>
        </tfoot>
      </table>
      {view.totals.pricesIncludeTax ? <p className="m-0 font-ui text-xs text-text-subtle">{t('pricesIncludeTax')}</p> : null}
    </article>
  );
}
