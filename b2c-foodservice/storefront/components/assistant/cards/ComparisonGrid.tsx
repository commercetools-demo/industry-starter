// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/generative/ComparisonGrid.tsx; changes: strings through next-intl, money through useAgentMoney, one column until the card itself is wide (container query, not viewport), pros and cons announced to assistive tech.

'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useAgentMoney } from '../money';
import type { ComparisonPayload } from '../payloads';
import { PriceLabel, ProductImage, ProductTitle, Rating } from './ProductTile';

/** The sign has its own column so text shares a left edge across rows. */
function TermRow({ sign, text }: { sign: '+' | '−'; text: string }) {
  const t = useTranslations('assistant.cards');
  return (
    <div className="grid grid-cols-[1.1rem_1fr] text-sm leading-normal text-(--ink)">
      <span aria-hidden className={sign === '+' ? 'text-(--ok)' : 'text-(--ink-soft)'}>
        {sign}
      </span>
      <span>
        <span className="sr-only">{sign === '+' ? t('pro') : t('con')}: </span>
        {text}
      </span>
    </div>
  );
}

export default function ComparisonGrid({ payload, partial }: { payload: ComparisonPayload; partial?: boolean }) {
  const t = useTranslations('assistant.cards');
  const money = useAgentMoney();
  const entries = payload.entries ?? [];
  const delta = payload.price_delta;
  const currency = entries[0]?.product.currency;
  // Each pro/con line is a subgrid row (once the card is wide enough for two columns), padded to the longest list, so the k-th line
  // of every column shares a baseline.
  const maxPros = Math.max(0, ...entries.map((entry) => (entry.pros ?? []).length));
  const maxCons = Math.max(0, ...entries.map((entry) => (entry.cons ?? []).length));
  const cardRows = { '--cmp-rows': `span ${2 + maxPros + maxCons}` } as CSSProperties;
  return (
    <section className="@container rounded-2xl border border-(--line) bg-(--card) p-4 shadow-(--shadow-sm)">
      {payload.title ? <h3 className="mb-3 text-[15px] font-semibold text-(--ink)">{payload.title}</h3> : null}
      <div data-comparison-grid className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
        {entries.map((entry) => {
          const recommended = payload.recommended_product_id === entry.product_id;
          const pros = entry.pros ?? [];
          const cons = entry.cons ?? [];
          return (
            <div
              key={entry.product_id}
              style={cardRows}
              className={`grid content-start gap-2 rounded-xl border p-4 @lg:grid-rows-subgrid @lg:[grid-row:var(--cmp-rows)] ${
                recommended ? 'border-(--accent) bg-(--accent-soft)' : 'border-(--line)'
              }`}
            >
              <div className="flex items-center gap-3">
                <ProductImage product={entry.product} className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  {recommended ? (
                    <div className="text-[11px] font-bold tracking-wide text-(--ink) uppercase">{t('recommended')}</div>
                  ) : null}
                  <ProductTitle title={entry.product.title} className="line-clamp-2 text-sm leading-snug font-medium" />
                  <div className="flex items-center gap-2 text-sm">
                    <PriceLabel product={entry.product} className="font-semibold" />
                    <Rating rating={entry.product.rating} count={entry.product.review_count} />
                  </div>
                </div>
              </div>
              <div>
                {entry.best_for ? (
                  <div className="rounded-md bg-(--well) px-2 py-1 text-[13px] text-(--ink)">{t('bestFor', { text: entry.best_for })}</div>
                ) : null}
              </div>
              {pros.map((pro) => (
                <TermRow key={pro} sign="+" text={pro} />
              ))}
              {/* Pads keep a shorter pros list from pulling its cons up. */}
              {Array.from({ length: maxPros - pros.length }, (_, index) => (
                <div key={`pro-pad-${index}`} className="hidden @lg:block" aria-hidden />
              ))}
              {cons.map((con) => (
                <TermRow key={con} sign="−" text={con} />
              ))}
              {Array.from({ length: maxCons - cons.length }, (_, index) => (
                <div key={`con-pad-${index}`} className="hidden @lg:block" aria-hidden />
              ))}
            </div>
          );
        })}
        {partial ? <div style={cardRows} className="ac-skeleton h-36 rounded-xl @lg:[grid-row:var(--cmp-rows)]" aria-hidden /> : null}
      </div>
      {delta ? (
        <p className="mt-3 text-[13px] text-(--ink)">
          {t('priceDifference')} <span className="font-semibold">{money(delta.amount, currency)}</span>{' '}
          <span className="text-(--ink-soft)">
            ({t('priceVs', { low: money(delta.low_price, currency), high: money(delta.high_price, currency) })})
          </span>
        </p>
      ) : null}
      {payload.dimensions?.length ? (
        <p className="mt-3 text-xs text-(--ink-soft)">{t('comparedOn', { dimensions: payload.dimensions.join(' · ') })}</p>
      ) : null}
    </section>
  );
}
