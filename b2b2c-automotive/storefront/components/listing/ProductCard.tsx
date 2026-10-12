// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The product card of the listing (workstream L). Exported for K (popular block on the home page), M (related parts) and N.
//   <ProductCard product={summary} store={storeKey} fit={getFitState(summary, vehicle)} city={branchCity} shipDays={settings.shipDays} alternativesHref={listingUrlWithoutFit} />
// Build `product` with `mapProductSummary` / `getProductSummaries` (lib/ct/products.ts), compute `fit` on the server with
// `getFitState` from `@/lib/search/fitment`. The card adds one unit through `useAddToCart` (POST /api/cart/lines).
'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { FitBadge } from '@/components/vehicle/FitBadge';
import { productImageLoader } from '@/components/listing/image-loader';
import { useAddToCart } from '@/hooks/useAddToCart';
import { Link } from '@/i18n/routing';
import type { FitState } from '@/lib/search/fitment';
import type { ProductSummary } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

export interface ProductCardProps {
  product: ProductSummary;
  /** Store key of the address (`/{locale}/{store}`). */
  store: string;
  fit: FitState;
  /** City of the selected branch for "In stock · {city}"; the line reads "In stock" without it. */
  city?: string;
  /** From the store settings: "Ships in {min}–{max} days". */
  shipDays: { min: number; max: number };
  /** Listing address with the fit filter removed and the category kept (store path without locale), for "View fitting alternatives". */
  alternativesHref: string;
}

export function ProductCard({ product, store, fit, city, shipDays, alternativesHref }: ProductCardProps) {
  const t = useTranslations('card');
  const locale = useLocale();
  const priceNote = useId();
  const { add, isAdding, error } = useAddToCart();
  const [added, setAdded] = useState(false);
  const href = `/${store}/p/${product.slug}`;

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 3000);
    return () => clearTimeout(timer);
  }, [added]);

  async function onAdd() {
    setAdded(false);
    if (await add(product.sku, 1)) setAdded(true);
  }

  const money = (cent: number, currency: string, digits: number) => formatMoney(cent, currency, locale, digits);
  const price = product.price;

  return (
    <article className="grid content-start gap-2 rounded-md border border-border bg-surface p-3 shadow-card">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] overflow-hidden rounded-md bg-surface-subtle">
        {product.imageUrl ? (
          <Image loader={productImageLoader} src={product.imageUrl} alt={product.imageAlt} fill sizes="(min-width: 700px) 220px, 50vw" className="object-contain" />
        ) : (
          <span className="flex size-full items-center justify-center font-ui text-xs text-text-subtle">{t('noPhoto')}</span>
        )}
      </Link>
      <div className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{product.brand}</div>
      <Link href={href} className="line-clamp-2 min-h-[2.625rem] font-display text-sm font-medium leading-normal text-text hover:text-text-link">
        {product.name}
      </Link>
      {product.rating ? (
        <span role="img" aria-label={t('rating', { average: product.rating.average.toFixed(1), count: product.rating.count })} className="font-ui text-xs text-rating">
          <span aria-hidden="true">
            ★ {product.rating.average.toFixed(1)} <span className="text-text-subtle">({product.rating.count})</span>
          </span>
        </span>
      ) : null}
      <FitBadge state={fit} />
      <div className="flex items-baseline gap-2" id={priceNote}>
        {price ? (
          <>
            <span className="font-display text-xl font-semibold text-text-price">{money(price.centAmount, price.currencyCode, price.fractionDigits)}</span>
            {price.oldCentAmount !== undefined ? (
              <>
                <s className="font-display text-sm text-text-price-old">{money(price.oldCentAmount, price.currencyCode, price.fractionDigits)}</s>
                <span className="sr-only">{t('oldPrice', { price: money(price.oldCentAmount, price.currencyCode, price.fractionDigits) })}</span>
              </>
            ) : null}
          </>
        ) : (
          <span className="font-display text-sm font-medium text-text-muted">{t('priceUnavailable')}</span>
        )}
      </div>
      <div className={`font-ui text-xs ${product.stock.atBranch ? 'text-success-600' : 'text-accent-700'}`}>
        {product.stock.atBranch ? (city ? t('inStockAt', { city }) : t('inStock')) : t('shipsIn', { min: shipDays.min, max: shipDays.max })}
      </div>
      {fit === 'does-not-fit' ? (
        <Link href={alternativesHref} className={buttonClass('secondary', 'w-full')}>
          {t('viewAlternatives')}
        </Link>
      ) : product.variantCount > 1 ? (
        <Link href={href} className={buttonClass('secondary', 'w-full')}>
          {t('chooseOptions')}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={!price || isAdding}
          aria-describedby={price ? undefined : priceNote}
          className={buttonClass('primary', 'w-full')}
        >
          {isAdding ? t('adding') : t('addToCart')}
        </button>
      )}
      <p aria-live="polite" className="min-h-0 font-ui text-xs text-success-600">
        {added ? t('added') : null}
      </p>
      {error ? (
        <p role="alert" className="font-ui text-xs text-danger-600">
          {error === 'price-unavailable' ? t('addPriceMissing') : t('addFailed')}
        </p>
      ) : null}
    </article>
  );
}
