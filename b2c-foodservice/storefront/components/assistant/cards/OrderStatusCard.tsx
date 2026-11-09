// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/generative/OrderStatusCard.tsx; changes: ISO date parsing deleted (dates render exactly as the server sent them, only when present), strings through next-intl, money through useAgentMoney, "View order" link for a validated https or same-origin path, status words from the catalogue.

'use client';

import { Fragment } from 'react';
import Icon from '@/components/ui/Icon';
import { useTranslations } from 'next-intl';
import { useAgentMoney } from '../money';
import type { CardOrder, OrderStatusPayload } from '../payloads';

/** Rail stages reached; statuses absent here render no rail. */
const RAIL_PROGRESS: Record<string, number> = {
  processing: 1,
  shipped: 3,
  delayed: 3,
  out_for_delivery: 3,
  delivered: 4,
};

const RAIL_STAGES = ['ordered', 'packed', 'shipped', 'delivered'] as const;

/** An https URL or a same-origin path ("/..." but not protocol-relative "//..."); anything else renders no link. */
export function safeViewHref(url: string | undefined): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return url;
  return null;
}

function DeliveryRail({ order }: { order: CardOrder }) {
  const t = useTranslations('assistant.cards');
  const status = order.status;
  const reached = status ? RAIL_PROGRESS[status] : undefined;
  if (reached == null) return null;
  const delayed = status === 'delayed';
  // The dates are the server's own strings, shown as sent.
  const placed = order.placed_at;
  const estimate = order.estimated_delivery;

  return (
    <div className="mt-3" data-delivery-rail>
      <div className="flex items-center" aria-hidden>
        {RAIL_STAGES.map((stage, index) => {
          const complete = index < reached;
          const isDelaySegment = delayed && index === RAIL_STAGES.length - 1;
          return (
            <Fragment key={stage}>
              {index > 0 ? (
                <div
                  className={`relative h-1 flex-1 rounded-full ${index < reached ? 'bg-(--ok)' : isDelaySegment ? 'bg-(--warn)' : 'bg-(--well)'}`}
                >
                  {isDelaySegment ? (
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--warn-soft) px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-(--warn)">
                      {t('delayedChip')}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  complete
                    ? 'bg-(--ok) text-(--surface)'
                    : index === reached
                      ? 'border-2 border-(--ok) bg-(--card)'
                      : 'border-2 border-(--line) bg-(--card)'
                }`}
              >
                {complete ? <Icon name="check" size={12} /> : null}
              </div>
            </Fragment>
          );
        })}
      </div>
      <ol className="mt-1.5 flex justify-between text-[11px] leading-tight">
        {RAIL_STAGES.map((stage, index) => {
          const complete = index < reached;
          const last = index === RAIL_STAGES.length - 1;
          return (
            <li
              key={stage}
              className={`${index === 0 ? 'text-left' : last ? 'text-right' : 'text-center'} ${complete ? 'font-semibold text-(--ink)' : 'text-(--ink-soft)'}`}
            >
              <div>
                {stage === 'ordered'
                  ? t('railOrdered')
                  : stage === 'packed'
                    ? t('railPacked')
                    : stage === 'shipped'
                      ? t('railShipped')
                      : t('railDelivered')}
                {complete ? <span className="sr-only"> ({t('railDone')})</span> : null}
              </div>
              {index === 0 && placed ? <div className="font-normal text-(--ink-soft)">{placed}</div> : null}
              {last && estimate ? (
                <div className={`font-normal ${delayed ? 'font-bold text-(--warn)' : 'text-(--ink-soft)'}`}>{estimate}</div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  processing: 'bg-(--well) text-(--ink)',
  shipped: 'bg-(--info-soft) text-(--info)',
  out_for_delivery: 'bg-(--accent-soft) text-(--ink)',
  delivered: 'bg-(--ok-soft) text-(--ok)',
  delayed: 'bg-(--warn-soft) text-(--warn)',
  cancelled: 'bg-(--well) text-(--ink-soft)',
  return_initiated: 'bg-(--violet-soft) text-(--violet)',
  refunded: 'bg-(--ok-soft) text-(--ok)',
};

export default function OrderStatusCard({ payload }: { payload: OrderStatusPayload }) {
  const t = useTranslations('assistant.cards');
  const money = useAgentMoney();
  const order = payload.order;
  const trackingHref = order?.tracking_url && /^https?:\/\//i.test(order.tracking_url) ? order.tracking_url : null;
  const viewHref = safeViewHref(order?.view_url);
  const status = order?.status;
  return (
    <section className="rounded-2xl border border-(--line) bg-(--card) p-4 shadow-(--shadow-sm)">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold break-words text-(--ink)">{t('orderTitle', { id: payload.order_id })}</h3>
        {status ? (
          // Computed keys (order status words, listed for the key-scrape test): status.processing, status.shipped, status.out_for_delivery,
          // status.delivered, status.delayed, status.cancelled, status.return_initiated, status.refunded.
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.processing}`}
          >
            {t(`status.${status}`)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-(--ink)">{payload.summary}</p>
      {order ? <DeliveryRail order={order} /> : null}
      {order ? (
        <div className="mt-3 space-y-1 rounded-lg bg-(--well) p-3 text-sm">
          {order.items.map((item) => (
            <div key={item.product_id} className="flex justify-between gap-2">
              <span className="truncate text-(--ink)">{t('lineQuantity', { title: item.title, quantity: item.quantity })}</span>
              <span className="shrink-0 text-(--ink-soft)">{money(item.price * item.quantity, order.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-(--line) pt-1 font-medium text-(--ink)">
            <span>{t('total')}</span>
            <span>{money(order.total, order.currency)}</span>
          </div>
          {order.estimated_delivery && (status == null || RAIL_PROGRESS[status] == null) ? (
            // The rail shows the estimate for its own statuses; this line covers the rest.
            <div className="text-[13px] text-(--ink-soft)">{t('estimatedDelivery', { date: order.estimated_delivery })}</div>
          ) : null}
        </div>
      ) : null}
      {trackingHref || viewHref ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewHref ? (
            <a
              href={viewHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-3 py-1.5 text-[13px] font-semibold text-(--ink) transition hover:border-(--accent) hover:shadow-(--shadow-sm)"
            >
              {t('viewOrder')}
            </a>
          ) : null}
          {trackingHref ? (
            <a
              href={trackingHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-3 py-1.5 text-[13px] font-semibold text-(--ink) transition hover:border-(--accent) hover:shadow-(--shadow-sm)"
            >
              {t('trackPackage')}
            </a>
          ) : null}
        </div>
      ) : null}
      {payload.next_step ? <p className="mt-2 text-[15px] font-medium text-(--ink)">{payload.next_step}</p> : null}
    </section>
  );
}
