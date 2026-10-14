// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { ProductCard, type ProductCardProps } from '@/components/listing/ProductCard';
import type { FitState } from '@/lib/search/fitment';
import type { ProductSummary } from '@/lib/types';

export interface GridItem {
  product: ProductSummary;
  fit: FitState;
}

/**
 * Cards in a grid of at least 220 px (13.75 rem) per card with a 16 px gap (design: `repeat(auto-fill, minmax(220px, 1fr))`).
 * Also used by the skeleton, so the loading state has the same geometry.
 */
export const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-4';

export function ProductGrid({ items, label, ...card }: { items: GridItem[]; label: string } & Omit<ProductCardProps, 'product' | 'fit'>) {
  return (
    <ul aria-label={label} className={`${GRID_CLASS} list-none p-0`}>
      {items.map(({ product, fit }) => (
        <li key={product.id} className="min-w-0">
          <ProductCard product={product} fit={fit} {...card} />
        </li>
      ))}
    </ul>
  );
}
