// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/generative/ProductCarousel.tsx; changes: price-history sparkline and review-sentiment bars deleted, strings through next-intl, money through useAgentMoney, add by product id through the onAdd prop, family tiles never add, variants listed as text, detail read through assistantApi, grid and masks use container queries and tokens.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { assistantApi } from '@/hooks/assistantApi';
import { useAgentMoney } from '../money';
import type { CardProduct, CardProductDetail, ProductsPayload } from '../payloads';
import ProductTile, {
  type AddHandler,
  AddButton,
  OptionLine,
  OutOfStockPill,
  PickOptionNote,
  PriceLabel,
  ProductImage,
  ProductRow,
  Rating,
  hasOptions,
  optionValuesLabel,
} from './ProductTile';

/** The variants of a family, as information: choosing one is settled with the assistant, so nothing here writes the cart. */
function VariantList({ variants }: { variants: CardProduct[] }) {
  const t = useTranslations('assistant.cards');
  const money = useAgentMoney();
  const pricesDiffer = variants.some((variant) => variant.price !== variants[0]?.price);
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('options')}>
      {variants.map((variant) => {
        const available = variant.in_stock !== false;
        return (
          <li
            key={variant.product_id}
            className={`rounded-full border border-(--line) bg-(--card) px-2.5 py-1 text-[12px] ${available ? 'text-(--ink)' : 'text-(--ink-soft) line-through'}`}
          >
            {optionValuesLabel(variant) || variant.title}
            {pricesDiffer ? <span className="text-(--ink-soft)"> · {money(variant.price, variant.currency)}</span> : null}
            {available ? null : <span className="sr-only"> ({t('outOfStock')})</span>}
          </li>
        );
      })}
    </ul>
  );
}

function ProductDetail({
  product,
  reason,
  onAdd,
  onClose,
}: {
  product: CardProduct;
  reason?: string;
  onAdd?: AddHandler;
  onClose: () => void;
}) {
  const t = useTranslations('assistant.cards');
  // `undefined` while loading, `null` when the read failed.
  const [detail, setDetail] = useState<CardProductDetail | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    void assistantApi.cardProduct(product.product_id).then((value) => {
      if (mounted) setDetail(value ? (value as unknown as CardProductDetail) : null);
    });
    return () => {
      mounted = false;
    };
  }, [product.product_id]);

  const full = detail?.product ?? product;
  const family = hasOptions(full);
  return (
    <div className="ac-reveal mt-3 mb-1 rounded-xl border border-(--line) bg-(--well) p-3">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <ProductImage product={full} className="h-24 w-28 rounded-lg" />
          {onAdd && full.in_stock !== false && !family ? (
            <AddButton product={full} onAdd={onAdd} className="absolute right-1 bottom-1" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              {full.brand ? <div className="text-[11px] tracking-wide text-(--ink-soft) uppercase">{full.brand}</div> : null}
              <div className="text-sm leading-snug font-semibold">{full.title}</div>
              <OptionLine product={full} />
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <PriceLabel product={full} className="text-sm font-bold" />
                <Rating rating={full.rating} count={full.review_count} />
                {full.in_stock === false ? <OutOfStockPill /> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('collapseDetails')}
              className="shrink-0 rounded-md px-1.5 text-base leading-none text-(--ink-soft) hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--accent)"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>
      </div>
      {reason ? <p className="mt-2 text-[13px] leading-snug text-(--ink)">{reason}</p> : null}
      {full.short_description ? <p className="mt-2 text-[13px] leading-relaxed text-(--ink)">{full.short_description}</p> : null}
      {family ? <PickOptionNote className="mt-2" /> : null}
      {detail === undefined ? (
        <p className="mt-2 animate-pulse text-[13px] text-(--ink-soft)" role="status">
          {t('loadingDetails')}
        </p>
      ) : detail === null ? (
        <p className="mt-2 text-[13px] text-(--ink-soft)">{t('detailsUnavailable')}</p>
      ) : detail.variants.length > 0 ? (
        <VariantList variants={detail.variants} />
      ) : null}
    </div>
  );
}

export default function ProductCarousel({ payload, onAdd, partial }: { payload: ProductsPayload; onAdd?: AddHandler; partial?: boolean }) {
  const t = useTranslations('assistant.cards');
  const layout = payload.layout ?? 'carousel';
  const items = payload.items ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Keep the last product mounted while the panel folds shut, so collapse animates.
  const [renderedId, setRenderedId] = useState<string | null>(null);
  const collapseRef = useRef<HTMLDivElement>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const syncOverflow = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setOverflow({ left: node.scrollLeft > 4, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    syncOverflow();
    const node = scrollerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [syncOverflow, items.length, partial, layout]);
  const nudge = (direction: 1 | -1) => {
    const node = scrollerRef.current;
    node?.scrollBy({ left: direction * (node.clientWidth - 80), behavior: 'smooth' });
  };

  useEffect(() => {
    if (expandedId) {
      // Bring the unfolding panel into view once it has height.
      const timer = window.setTimeout(() => collapseRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 180);
      return () => window.clearTimeout(timer);
    }
  }, [expandedId]);

  const rendered = items.find(({ product }) => product.product_id === renderedId);
  const open = expandedId != null && expandedId === renderedId;
  const toggle = (product: CardProduct) => {
    const next = expandedId === product.product_id ? null : product.product_id;
    setExpandedId(next);
    if (next) setRenderedId(next);
  };

  return (
    <section className="@container rounded-2xl border border-(--line) bg-(--card) p-3 shadow-(--shadow-sm)">
      {payload.title ? <h3 className="mb-3 text-[15px] font-semibold text-(--ink)">{payload.title}</h3> : null}
      <div className="relative">
        <div
          ref={scrollerRef}
          data-layout={layout}
          onScroll={layout === 'carousel' ? syncOverflow : undefined}
          className={
            layout === 'grid'
              ? 'grid grid-cols-2 gap-3 @lg:grid-cols-3'
              : layout === 'list'
                ? 'flex flex-col gap-3'
                : 'panel-scroll flex gap-3 overflow-x-auto pb-1'
          }
        >
          {items.map(({ product }) => (
            <div key={product.product_id} className={`ac-reveal ${layout === 'carousel' ? 'shrink-0' : 'min-w-0'}`}>
              {layout === 'list' ? (
                <ProductRow product={product} onAdd={onAdd} />
              ) : (
                <ProductTile
                  product={product}
                  fluid={layout === 'grid'}
                  onAdd={onAdd}
                  onOpen={toggle}
                  selected={product.product_id === expandedId}
                />
              )}
              {layout === 'list' ? (
                <button
                  type="button"
                  onClick={() => toggle(product)}
                  aria-expanded={product.product_id === expandedId}
                  className="mt-1 ml-2 text-[12px] font-medium text-(--accent-ink) underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                >
                  {t('details', { title: product.title })}
                </button>
              ) : null}
            </div>
          ))}
          {partial ? <div className="ac-skeleton h-[150px] w-48 shrink-0 rounded-xl" aria-hidden /> : null}
        </div>
        {layout === 'carousel' && overflow.left ? (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-(--card) to-transparent" />
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label={t('scrollPrev')}
              className="absolute top-1/2 left-0 -translate-y-1/2 rounded-full border border-(--line) bg-(--card) p-1 text-(--ink) shadow-md transition hover:border-(--accent)"
            >
              <Icon name="chevL" size={16} />
            </button>
          </>
        ) : null}
        {layout === 'carousel' && overflow.right ? (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-(--card) to-transparent" />
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label={t('scrollNext')}
              className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full border border-(--line) bg-(--card) p-1 text-(--ink) shadow-md transition hover:border-(--accent)"
            >
              <Icon name="chevR" size={16} />
            </button>
          </>
        ) : null}
      </div>
      <div
        ref={collapseRef}
        className={`ac-collapse ${open ? 'ac-collapse-open' : ''}`}
        onTransitionEnd={(event) => {
          if (event.propertyName === 'grid-template-rows' && !expandedId) setRenderedId(null);
        }}
        inert={!open}
      >
        <div className="ac-collapse-inner">
          {rendered ? (
            <ProductDetail
              key={rendered.product.product_id}
              product={rendered.product}
              reason={rendered.reason}
              onAdd={onAdd}
              onClose={() => setExpandedId(null)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
