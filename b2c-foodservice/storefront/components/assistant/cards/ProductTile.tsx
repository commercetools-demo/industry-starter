// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/ProductTile.tsx; changes: strings through next-intl, money through useAgentMoney, add goes through the onAdd prop by product id (a family never adds), neutral image placeholder, no fly-to-cart, delivery promise, low stock and returns line removed (the server sends none).

'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { useAgentMoney } from '../money';
import type { CardProduct } from '../payloads';

export type AddHandler = (productId: string, quantity?: number) => Promise<boolean>;

/** True for a family record: the cart takes one of its variants, which the shopper settles with the assistant. */
export function hasOptions(product: Pick<CardProduct, 'options'>): boolean {
  return Object.keys(product.options ?? {}).length > 0;
}

/** "twin · full · queen", one group per option separated by " / "; empty for a plain product. */
export function optionSummary(product: Pick<CardProduct, 'options'>): string {
  return Object.values(product.options ?? {})
    .map((values) => values.join(' · '))
    .join(' / ');
}

/** "king · slate" for a variant; empty when nothing was chosen. */
export function optionValuesLabel(item: Pick<CardProduct, 'option_values'>): string {
  return Object.values(item.option_values ?? {}).join(' · ');
}

/** What a variant chose, or what a family still needs chosen; empty otherwise. */
function optionText(product: CardProduct): string {
  return optionValuesLabel(product) || optionSummary(product);
}

/** A trailing parenthetical such as "(48-Pack)" is kept unbreakable so the clamp cuts before it. */
export function ProductTitle({ title, className = '' }: { title: string; className?: string }) {
  const match = /^(.*\S)\s+(\([^()]+\))$/.exec(title);
  return (
    <div className={className} title={title}>
      {match ? (
        <>
          {match[1]} <span className="whitespace-nowrap">{match[2]}</span>
        </>
      ) : (
        title
      )}
    </div>
  );
}

/** The product's own image when the server sent one, else a neutral block. Never an invented URL. */
export function ProductImage({ product, className = '' }: { product: CardProduct; className?: string }) {
  if (product.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.image_url} alt="" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-(--well) text-(--ink-faint) ${className}`} aria-hidden data-image-placeholder>
      <Icon name="pkg" size={28} />
    </div>
  );
}

export function Rating({ rating, count }: { rating?: number; count?: number }) {
  const t = useTranslations('assistant.cards');
  const format = useFormatter();
  if (rating == null) return null;
  return (
    <span className="text-[13px] whitespace-nowrap text-(--ink-soft)">
      <span className="sr-only">{t('rating', { rating: rating.toFixed(1) })}</span>
      <span aria-hidden>
        <span className="inline-flex text-(--star)">
          <Icon name="star" size={12} fill="currentColor" />
        </span>{' '}
        {rating.toFixed(1)}
        {count ? <span className="text-[11px]"> ({format.number(count)})</span> : null}
      </span>
    </span>
  );
}

export function OptionLine({ product, className = '' }: { product: CardProduct; className?: string }) {
  const text = optionText(product);
  if (!text) return null;
  return <div className={`truncate text-[11px] text-(--ink-soft) ${className}`}>{text}</div>;
}

export function OutOfStockPill({ className = '' }: { className?: string }) {
  const t = useTranslations('assistant.cards');
  return (
    <span className={`rounded-full bg-(--ink) px-2 py-0.5 text-[11px] font-medium text-(--surface) ${className}`}>{t('outOfStock')}</span>
  );
}

/** "$349.00", or "From $349.00" on a family whose price is its lowest variant's. */
export function PriceLabel({ product, className = '' }: { product: CardProduct; className?: string }) {
  const t = useTranslations('assistant.cards');
  const money = useAgentMoney();
  const price = money(product.price, product.currency);
  return <span className={className}>{hasOptions(product) ? t('from', { price }) : price}</span>;
}

/** The sentence a family shows in place of an add control: the choice is settled with the assistant, never written from the card. */
export function PickOptionNote({ className = '' }: { className?: string }) {
  const t = useTranslations('assistant.cards');
  return (
    <div className={`text-[11px] leading-snug text-(--ink-soft) ${className}`} data-pick-option>
      {t('pickOption')}
    </div>
  );
}

/**
 * Add to the assistant's cart by product id. An onAdd that resolves false means the server held the write. A family has no button at
 * all (callers render PickOptionNote), so this control only ever sees a plain product.
 */
export function AddButton({ product, onAdd, className = '' }: { product: CardProduct; onAdd: AddHandler; className?: string }) {
  const t = useTranslations('assistant.cards');
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const label =
    phase === 'busy'
      ? t('adding')
      : phase === 'done'
        ? t('added')
        : phase === 'error'
          ? t('addFailed')
          : t('addLabel', { title: product.title });
  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        if (phase !== 'idle') return;
        setPhase('busy');
        let added = false;
        try {
          added = (await onAdd(product.product_id)) !== false;
        } catch {
          added = false;
        }
        setPhase(added ? 'done' : 'error');
        timer.current = window.setTimeout(() => setPhase('idle'), added ? 1200 : 1600);
      }}
      aria-label={label}
      aria-busy={phase === 'busy'}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none font-semibold text-(--surface) shadow-(--shadow-sm) transition-all hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${
        phase === 'done' ? 'bg-(--ok)' : phase === 'error' ? 'bg-(--warn)' : 'bg-(--ink)'
      } ${phase === 'busy' ? 'animate-pulse' : ''} ${className}`}
    >
      <span aria-hidden>{phase === 'done' ? '✓' : phase === 'error' ? '!' : '+'}</span>
    </button>
  );
}

export default function ProductTile({
  product,
  compact = false,
  fluid = false,
  selected = false,
  onAdd,
  onOpen,
}: {
  product: CardProduct;
  compact?: boolean;
  /** Fills its grid cell instead of the carousel's fixed width. */
  fluid?: boolean;
  selected?: boolean;
  onAdd?: AddHandler;
  onOpen?: (product: CardProduct) => void;
}) {
  const t = useTranslations('assistant.cards');
  const outOfStock = product.in_stock === false;
  const family = hasOptions(product);
  const imageHeight = compact ? 'h-16' : 'h-24';
  const labels = compact ? [] : (product.labels ?? []).slice(0, 2);
  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-(--card) shadow-(--shadow-sm) transition-[box-shadow,border-color] duration-200 hover:shadow-md ${
        fluid ? 'w-full' : compact ? 'w-36' : 'w-48'
      } ${selected ? 'border-(--ink)' : 'border-(--line)'}`}
    >
      <div className="relative">
        <ProductImage product={product} className={`w-full ${imageHeight} ${outOfStock ? 'opacity-50' : ''}`} />
        {outOfStock ? <OutOfStockPill className="absolute top-1.5 right-1.5" /> : null}
        {onAdd && !outOfStock && !family ? <AddButton product={product} onAdd={onAdd} className="absolute right-2 bottom-2" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        {product.brand ? <div className="text-[11px] tracking-wide text-(--ink-soft) uppercase">{product.brand}</div> : null}
        <ProductTitle title={product.title} className={`line-clamp-2 text-[13px] leading-snug font-medium ${compact ? '' : 'h-9'}`} />
        {compact ? null : optionText(product) ? (
          <OptionLine product={product} className="h-[18px] pt-0.5 leading-4" />
        ) : (
          <div className="flex h-[18px] flex-wrap gap-1 overflow-hidden pt-0.5" aria-hidden={labels.length === 0}>
            {labels.map((label) => (
              <span key={label} className="rounded-full bg-(--well) px-1.5 py-px text-[11px] leading-4 whitespace-nowrap text-(--ink-soft)">
                {label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-1 pt-0.5">
          <PriceLabel product={product} className="text-sm font-semibold" />
          <Rating rating={product.rating} count={compact ? undefined : product.review_count} />
        </div>
        {family && !outOfStock && onAdd ? <PickOptionNote className="pt-1" /> : null}
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(product)}
            aria-expanded={selected}
            className="mt-1 self-start text-[12px] font-medium text-(--accent-ink) underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            {t('details', { title: product.title })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ProductRow({ product, onAdd }: { product: CardProduct; onAdd?: AddHandler }) {
  const outOfStock = product.in_stock === false;
  const family = hasOptions(product);
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-(--line) bg-(--card) p-2 shadow-(--shadow-sm) transition-shadow hover:shadow-md">
      <div className="relative shrink-0">
        <ProductImage product={product} className={`h-14 w-16 rounded-lg ${outOfStock ? 'opacity-50' : ''}`} />
        {onAdd && !outOfStock && !family ? <AddButton product={product} onAdd={onAdd} className="absolute right-1 bottom-1" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        {product.brand ? <div className="text-[11px] tracking-wide text-(--ink-soft) uppercase">{product.brand}</div> : null}
        <ProductTitle title={product.title} className="line-clamp-1 text-[13px] leading-snug font-medium" />
        <OptionLine product={product} />
        <div className="flex flex-wrap items-center gap-x-2">
          <PriceLabel product={product} className="text-sm font-semibold" />
          <Rating rating={product.rating} />
          {outOfStock ? <OutOfStockPill /> : null}
        </div>
        {family && !outOfStock && onAdd ? <PickOptionNote /> : null}
      </div>
    </div>
  );
}
