import 'server-only';
import { cache } from 'react';
import type { ProductPageData } from '@/lib/types';

/**
 * The product of the current request, shared with the page builder's product components. The product route loads the page data
 * once (`loadProductPage`, memoised per request, also used for not-found, redirect and metadata) and hands it over before it asks
 * the page builder for the layout. Server components that need the data (breadcrumbs, rating summary, reviews) read it here;
 * the client components read the same data from `PdpProvider`. `cache` gives one holder per server render.
 */
const holder = cache((): { data?: ProductPageData } => ({}));

export function provideProduct(data: ProductPageData): void {
  holder().data = data;
}

/** The product of this request, or null off a product page. */
export function requestProduct(): ProductPageData | null {
  return holder().data ?? null;
}
