// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/generative/CheckoutSummary.tsx; changes: rewritten for this store: lines, a discount row only when the platform sent a non-zero discount, the payable total from cent-exact totals (minor units), no shipping, tax or estimate rows, a "not charged" pill described by a sentence, and "Continue in my bag" as a client-side link to the bag (the assistant writes into the shopper's bag itself, so there is nothing to move: workstream T2).

'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { bagHref } from '@/lib/routes';
import { useAgentMoney, useCentMoney } from '../money';
import type { CheckoutPayload } from '../payloads';
import { ProductImage } from './ProductTile';

export default function CheckoutSummary({ payload }: { payload: CheckoutPayload }) {
  const t = useTranslations('assistant.cards');
  const money = useAgentMoney();
  const cents = useCentMoney();
  // Several summaries can coexist across turns, so the describedby ids are per card.
  const noteId = useId();
  const lines = payload.lines ?? [];
  const totals = payload.totals;
  const currency = totals?.currency ?? payload.cart?.currency;
  const discount = totals?.discount_minor;

  return (
    <section data-checkout-card className="rounded-2xl border-2 border-(--accent) bg-(--card) p-4 shadow-(--shadow-sm)">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-(--ink)">{t('checkoutTitle')}</h3>
        <div className="flex items-center gap-1.5">
          <span
            aria-describedby={noteId}
            className="rounded-full border border-(--line) bg-(--well) px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-(--ink-soft)"
          >
            {t('notCharged')}
          </span>
          {payload.fulfillment_method ? (
            <span className="rounded-full bg-(--accent-soft) px-2.5 py-0.5 text-[13px] font-semibold text-(--ink)">
              {payload.fulfillment_method === 'pickup'
                ? t('fulfilmentPickup')
                : payload.fulfillment_method === 'shipping'
                  ? t('fulfilmentShipping')
                  : t('fulfilmentDelivery')}
            </span>
          ) : null}
        </div>
      </div>
      {payload.note ? <p className="mt-1 text-[13px] text-(--ink-soft)">{payload.note}</p> : null}
      <div className="mt-3 space-y-2 rounded-lg bg-(--well) p-3 text-sm">
        {lines.map((line) => (
          <div key={line.product_id} className="flex items-center gap-2.5">
            <ProductImage
              product={{
                product_id: line.product_id,
                title: line.title,
                price: line.price,
                currency: currency ?? '',
                ...(line.image_url ? { image_url: line.image_url } : {}),
              }}
              className="h-10 w-10 shrink-0 rounded-lg"
            />
            <div className="flex min-w-0 flex-1 justify-between gap-2">
              <span className="line-clamp-2 text-(--ink)" title={line.title}>
                {t('lineQuantity', { title: line.title, quantity: line.quantity })}
              </span>
              <span className="shrink-0 text-(--ink)">{money(line.price * line.quantity, currency)}</span>
            </div>
          </div>
        ))}
        {totals ? (
          <div className="space-y-1 border-t border-(--line) pt-1.5">
            {discount ? (
              <>
                {totals.subtotal_minor != null ? (
                  <div className="flex justify-between text-(--ink)">
                    <span>{t('subtotal')}</span>
                    <span>{cents(totals.subtotal_minor, totals.currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-(--ok)">
                  <span>{t('discount')}</span>
                  <span>−{cents(discount, totals.currency)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between text-base font-bold text-(--ink)">
              <span>{t('total')}</span>
              <span>{cents(totals.total_minor, totals.currency)}</span>
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-center text-[13px] text-(--ink-soft)">{t('inBagNote')}</p>
      <Link
        href={bagHref()}
        aria-describedby={noteId}
        className="btn-primary mt-3 block w-full text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
      >
        {t('continueInBag')}
      </Link>
      <p id={noteId} className="mt-2 text-center text-[11px] text-(--ink-soft)">
        {t('notChargedNote')}
      </p>
    </section>
  );
}
