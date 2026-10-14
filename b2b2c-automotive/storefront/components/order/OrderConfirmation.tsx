// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { DeliveryDetails } from '@/components/order/DeliveryDetails';
import { FollowUpActions, type Viewer } from '@/components/order/FollowUpActions';
import { NextStepTimeline } from '@/components/order/NextStepTimeline';
import { OrderSummaryCard } from '@/components/order/OrderSummaryCard';
import { SubscriptionBlock } from '@/components/order/SubscriptionBlock';
import { SuccessMark } from '@/components/order/SuccessMark';
import { buildTimeline, nextStepSentence } from '@/lib/order/next-step';
import type { OrderView } from '@/lib/types';

interface Props {
  view: OrderView;
  store: string;
  viewer: Viewer;
  privatePath: string | null;
  token?: string;
}

/**
 * The confirmation page (design view `done`, extended by the spec gaps): success mark, heading, order number, the next-step sentence, the
 * payment state and the "no emails" note, then details (timeline, delivery or pickup, subscription) beside the order summary, then the
 * follow-up actions. The heading takes the focus on load so a screen reader starts there. Single column up to 680 px.
 */
export function OrderConfirmation({ view, store, viewer, privatePath, token }: Props) {
  const t = useTranslations('order');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const translateNext = (key: string, values?: Record<string, string | number>) => t(key, values);

  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <header className="mx-auto grid max-w-prose justify-items-center gap-3 text-center">
        <SuccessMark />
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-3xl font-semibold text-text outline-none">
          {t('heading')}
        </h1>
        <p className="m-0 font-ui text-sm font-bold text-text [font-variant-numeric:tabular-nums]">{t('numberLabel', { number: view.number })}</p>
        <p className="m-0 font-ui text-md text-text-body">{nextStepSentence(view, translateNext)}</p>
        <p className={`m-0 font-ui text-sm ${view.payment === 'failed' ? 'text-danger-600' : 'text-text-muted'}`}>
          {view.payment === 'paid' ? t('payment.paid') : view.payment === 'failed' ? t('payment.failed', { store: view.storeName }) : t('payment.pending')}
        </p>
        <p className="m-0 font-ui text-sm text-text-muted print:hidden">{viewer === 'owner' ? t('noEmailNoteAccount') : t('noEmailNote')}</p>
      </header>
      <div className="grid items-start gap-5 min-[42.5rem]:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <NextStepTimeline timeline={buildTimeline(view)} />
          <DeliveryDetails view={view} />
          <SubscriptionBlock view={view} store={store} signedIn={viewer === 'owner'} />
        </div>
        <OrderSummaryCard view={view} />
      </div>
      <FollowUpActions view={view} store={store} viewer={viewer} privatePath={privatePath} token={token} />
    </div>
  );
}
