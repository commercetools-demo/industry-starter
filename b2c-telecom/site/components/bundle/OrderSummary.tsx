/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { ReactElement, ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { FOCUS_RING } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import { summaryRows, type SummaryRowId } from '@/lib/pricing/summary';
import type { Cart, Locale, Money } from '@/lib/types';

/** Message key of each summed row (the order-level discount reads "Discounts"). */
const LABEL_OF: Record<SummaryRowId, string> = { plans: 'plans', addons: 'addons', devices: 'devices', oneTime: 'oneTime', orderDiscount: 'discounts', shipping: 'shipping', tax: 'tax' };

type OrderSummaryProps = {
  cart: Cart;
  signedIn: boolean;
  /** The discount code form (kept out of here so the summary stays presentational). */
  codeForm?: ReactNode;
  /** The "save my bundle" action of workstream T (renders nothing in M). */
  extra?: ReactNode;
};

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }): ReactElement {
  return (
    <div className={cx('flex justify-between gap-4', strong ? 'font-display text-2xl font-bold' : muted ? 'text-sm text-text-muted' : 'text-md')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Every figure is the server's (`cart.summary`); the rows add up to Due today (lib/pricing/summary). */
export function OrderSummary({ cart, signedIn, codeForm, extra }: OrderSummaryProps): ReactElement {
  const t = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const fmt = (money: Money): string => formatMoneyExact(money, locale);
  const { summary } = cart;
  const shortfall = cart.minimumOrder?.shortfall ?? null;

  return (
    <aside aria-label={t('summary.title')} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-7 lg:sticky lg:top-24">
      <h2 className="m-0 font-display text-xl font-bold tracking-ui">{t('summary.title')}</h2>
      {summaryRows(summary).map((row) => (
        <Row key={row.id} label={t(`summary.${LABEL_OF[row.id]}`)} value={fmt(row.amount)} muted={row.id === 'oneTime'} />
      ))}
      <div className="border-t border-border pt-4">
        <Row label={t('summary.dueToday')} value={fmt(summary.dueToday)} strong />
      </div>
      {summary.taxAdded === null && summary.tax && summary.tax.centAmount > 0 ? <p className="m-0 text-sm text-text-muted">{t('summary.taxIncluded', { amount: fmt(summary.tax) })}</p> : null}
      {summary.thenMonthly.centAmount > 0 ? (
        <div className="flex flex-col gap-1">
          <Row label={t('summary.thenMonthly')} value={fmt(summary.thenMonthly)} strong />
          <p className="m-0 text-sm text-text-muted">{t('summary.thenMonthlyNote')}</p>
        </div>
      ) : null}
      {summary.discountTotal.centAmount > 0 ? <Row label={t('summary.save')} value={fmt(summary.discountTotal)} muted /> : null}
      {codeForm}
      {shortfall && cart.minimumOrder ? (
        <p role="status" className="m-0 text-sm font-semibold">
          {t('minimum', { shortfall: fmt(shortfall), minimum: fmt(cart.minimumOrder.required) })}
        </p>
      ) : null}
      {cart.canCheckout ? (
        <Button href="/bundle/checkout" block>
          {t('cta.checkout')}
        </Button>
      ) : (
        <span
          role="link"
          aria-disabled="true"
          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-pill bg-action px-6 text-center font-cta text-md font-extrabold text-text-on-pink opacity-50"
        >
          {t('cta.blocked')}
        </span>
      )}
      {!signedIn ? (
        <Link href="/login?next=%2Fbundle%2Fcheckout" className={cx('text-center font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
          {t('cta.login')}
        </Link>
      ) : null}
      {extra}
      <p className="m-0 text-sm text-text-muted">{t('summary.taxNote')}</p>
    </aside>
  );
}
