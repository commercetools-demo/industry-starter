// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { productImageLoader } from '@/components/listing/image-loader';
import { useFinderDrawer } from '@/components/malva/FinderDrawerProvider';
import { buttonClass } from '@/components/ui/Button';
import { FitBadge } from '@/components/vehicle/FitBadge';
import type { MalvaProductSummary } from '@/lib/malva-types';
import type { FitState } from '@/lib/search/fitment';

/**
 * The card of the Malva listing (D4). It is a component of its own, not a mode of `ProductCard`, so a price, stock line or
 * Add to cart cannot appear by a mistaken flag: the model has none of that data, and the card has no link (Malva has no product
 * page). The only action opens the finder drawer with the product remembered.
 */
export function MalvaProductCard({ product, fit }: { product: MalvaProductSummary; fit: FitState }) {
  const t = useTranslations('malvaFinder');
  const { open } = useFinderDrawer();
  return (
    <article className="grid content-start gap-2 rounded-md border border-border bg-surface p-3 shadow-card">
      <div className="relative block aspect-[4/3] overflow-hidden rounded-md bg-surface-subtle">
        {product.imageUrl ? (
          <Image loader={productImageLoader} src={product.imageUrl} alt={product.imageAlt} fill sizes="(min-width: 700px) 220px, 50vw" className="object-contain" />
        ) : (
          <span className="flex size-full items-center justify-center font-ui text-xs text-text-subtle">{t('noPhoto')}</span>
        )}
      </div>
      {product.brand ? <div className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{product.brand}</div> : null}
      <h3 className="m-0 line-clamp-2 min-h-[2.625rem] font-display text-sm font-medium leading-normal text-text">{product.name}</h3>
      <div className="font-ui text-xs text-text-muted">{t('partNumber', { number: product.partNumber })}</div>
      <FitBadge state={fit} />
      <button type="button" aria-label={t('selectResellerFor', { name: product.name })} className={buttonClass('primary', 'w-full')} onClick={(event) => open({ productSlug: product.slug, opener: event.currentTarget })}>
        {t('selectReseller')}
      </button>
    </article>
  );
}
