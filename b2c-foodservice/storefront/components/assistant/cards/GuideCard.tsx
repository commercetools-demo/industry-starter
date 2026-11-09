// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/generative/GuideCard.tsx; changes: strings through next-intl, tokens instead of opacity shades.

'use client';

import { useTranslations } from 'next-intl';
import type { GuidePayload } from '../payloads';
import ProductTile from './ProductTile';

export default function GuideCard({ payload }: { payload: GuidePayload }) {
  const t = useTranslations('assistant.cards');
  return (
    <section className="rounded-2xl border border-(--line) bg-(--card) p-4 shadow-(--shadow-sm)">
      <h3 className="text-[15px] font-semibold text-(--ink)">{payload.title}</h3>
      <div className="mt-2 space-y-3">
        {(payload.sections ?? []).map((section, index) => (
          <div key={index}>
            <h4 className="text-[13px] font-bold tracking-wide text-(--ink) uppercase">{section.heading}</h4>
            <p className="mt-0.5 text-[15px] leading-relaxed text-(--ink)">{section.body}</p>
          </div>
        ))}
      </div>
      {payload.related_products?.length ? (
        <div className="panel-scroll mt-3 flex gap-3 overflow-x-auto border-t border-(--line) pt-3">
          {payload.related_products.map((product) => (
            <ProductTile key={product.product_id} product={product} compact />
          ))}
        </div>
      ) : null}
      {payload.sources?.length ? (
        <p className="mt-3 text-[11px] break-all text-(--ink-soft)">{t('sources', { sources: payload.sources.join(' · ') })}</p>
      ) : null}
    </section>
  );
}
