// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';
import { FitBadge } from '@/components/vehicle/FitBadge';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useGarage } from '@/hooks/useGarage';
import { Link } from '@/i18n/routing';
import { getFitState } from '@/lib/search/fitment';
import type { ProductSummary } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

function RelatedCard({ product, store }: { product: ProductSummary; store: string }) {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const { active } = useGarage();
  const { add, isAdding, error } = useAddToCart();
  const href = `/${store}/p/${product.slug}`;
  const price = product.price;
  return (
    <li className="grid content-start gap-2 rounded-md border border-border bg-surface p-3">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] overflow-hidden rounded-md bg-surface-subtle">
        {product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="220px" className="object-contain" /> : <span className="flex size-full items-center justify-center font-ui text-xs text-text-subtle">{t('noPhoto')}</span>}
      </Link>
      <div className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{product.brand}</div>
      <Link href={href} className="line-clamp-2 min-h-6 font-display text-sm font-medium text-text hover:text-text-link">
        {product.name}
      </Link>
      <FitBadge state={getFitState(product, active)} />
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-md font-semibold text-text-price">{price ? formatMoney(price.centAmount, price.currencyCode, locale, price.fractionDigits) : t('priceUnavailable')}</span>
        <button type="button" disabled={!price || isAdding || product.variantCount > 1} aria-label={t('addNamed', { name: product.name })} onClick={() => void add(product.sku, 1)} className={buttonClass('secondary', 'px-4')}>
          {isAdding ? t('adding') : t('relatedAdd')}
        </button>
      </div>
      {error ? (
        <p role="alert" className="m-0 font-ui text-xs text-danger-600">
          {error === 'price-unavailable' ? t('addPriceMissing') : t('addFailed')}
        </p>
      ) : null}
    </li>
  );
}

/** "Often bought together" (workstream M): the master's `related-skus`, else the same category; hidden when there is nothing. */
export function RelatedItems({ products, store }: { products: ProductSummary[]; store: string }) {
  const t = useTranslations('pdp');
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="pdp-related" className="grid gap-4">
      <h2 id="pdp-related" className="m-0 font-display text-xl font-semibold text-text">
        {t('related')}
      </h2>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-4 p-0">
        {products.map((product) => (
          <RelatedCard key={product.id} product={product} store={store} />
        ))}
      </ul>
    </section>
  );
}
