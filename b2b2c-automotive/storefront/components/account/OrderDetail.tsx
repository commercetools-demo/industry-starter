// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Notice, Panel } from '@/components/account/Panel';
import { StatusBadge } from '@/components/account/StatusBadge';
import { DeliveryDetails } from '@/components/order/DeliveryDetails';
import { OrderSummaryCard } from '@/components/order/OrderSummaryCard';
import { Button, buttonClass } from '@/components/ui/Button';
import { useOrderActions } from '@/hooks/useOrderActions';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import type { OrderView, ReturnEligibility, ReturnView } from '@/lib/types';

interface Props {
  view: OrderView;
  store: string;
  /** Order creation time (ISO). */
  createdAt: string;
  eligibility: ReturnEligibility;
  returns: ReturnView[];
}

/**
 * One order of the signed-in shopper: status, lines and totals (P's summary, the order's own money and tax), delivery or pickup block, payment
 * line, invoice link, "Order again" and, when the window allows it, "Request a return" (with the last day, or the reason it is not possible).
 * The payment line says "Paid online" because the order does not carry the card brand or last four digits.
 */
export function OrderDetail({ view, store, createdAt, eligibility, returns }: Props) {
  const t = useTranslations('account.order');
  const locale = useLocale();
  const { reorder } = useOrderActions();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | 'failed' | null>(null);
  const base = `/${store}/account/orders/${view.number}`;
  const paymentKey = view.payment === 'paid' ? 'paymentPaid' : view.payment === 'failed' ? 'paymentFailed' : 'paymentPending';
  const returnNote = eligibility.eligible
    ? t('returnUntil', { date: formatDate(eligibility.deadline, locale, view.timezone) })
    : eligibility.problem === 'window-closed'
      ? t('returnClosed')
      : eligibility.problem === 'nothing-left'
        ? t('returnNothingLeft')
        : t('returnNotDelivered');

  async function onReorder() {
    setPending(true);
    setResult(null);
    try {
      setResult(await reorder(view.number));
    } catch {
      setResult('failed');
    }
    setPending(false);
  }

  return (
    <div className="grid gap-5">
      <Link href={`/${store}/account/orders`} className="inline-flex min-h-7 items-center font-utility text-sm text-text-link underline-offset-2 hover:underline">
        ← {t('back')}
      </Link>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={view.status} />
          <span className="font-ui text-sm text-text-muted">{t('placedOn', { date: formatDate(createdAt, locale, view.timezone) })}</span>
          <span className="font-ui text-sm text-text-body">{t(paymentKey)}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`${base}/invoice`} className={buttonClass('secondary')}>
            {t('invoice')}
          </Link>
          <Button variant="secondary" onClick={onReorder} disabled={pending}>
            {pending ? t('reordering') : t('reorder')}
          </Button>
          {eligibility.eligible ? (
            <Link href={`${base}/return`} className={buttonClass('primary')}>
              {t('returnCta')}
            </Link>
          ) : null}
        </div>
        <p className="m-0 font-ui text-sm text-text-muted">{returnNote}</p>
        {result === 'failed' ? <Notice tone="error">{t('reorderFailed')}</Notice> : <Notice tone="success">{result && result.added > 0 ? t('reordered', { added: result.added }) : null}</Notice>}
        {result && result !== 'failed' && result.skipped > 0 ? <Notice tone="error">{t('reorderedSkipped', { skipped: result.skipped })}</Notice> : null}
        {result && result !== 'failed' && result.added > 0 ? (
          <div>
            <Link href={`/${store}/cart`} className="inline-flex min-h-7 items-center font-utility text-sm text-text-link underline-offset-2 hover:underline">
              {t('viewCart')}
            </Link>
          </div>
        ) : null}
      </Panel>
      <DeliveryDetails view={view} />
      <OrderSummaryCard view={view} />
      {returns.length > 0 ? (
        <Panel title={t('returnsTitle')} titleId="order-returns-title">
          <Link href={`/${store}/account/returns`} className="inline-flex min-h-7 items-center font-utility text-sm text-text-link underline-offset-2 hover:underline">
            {t('returnsOpen')} ({returns.length})
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
