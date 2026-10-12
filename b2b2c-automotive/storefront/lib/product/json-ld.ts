// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// schema.org Product data for the product page (workstream M). Pure.
import type { ProductDetail } from '@/lib/types';

/**
 * JSON for a `<script type="application/ld+json">`: `<` is written as `<`, so a name or review can never close the script
 * element (XSS), and the result is still valid JSON.
 */
export const serializeJsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c');

/** ISO amount string from minor units: 4590 with 2 digits is "45.90". */
const amount = (cent: number, digits: number): string => (cent / 10 ** digits).toFixed(digits);

/**
 * `Product` with `offers` only when there is a price (never a zero or missing offer). `availability` follows the stock at the
 * selected branch: in stock, else back order (the part ships to the store or to the door).
 */
export function buildProductJsonLd(product: ProductDetail, url: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    mpn: product.partNumber,
    url,
  };
  if (product.brand) data.brand = { '@type': 'Brand', name: product.brand };
  if (product.images.length > 0) data.image = product.images.map((i) => i.url);
  if (product.description) data.description = product.description;
  if (product.rating) data.aggregateRating = { '@type': 'AggregateRating', ratingValue: product.rating.average.toFixed(1), reviewCount: product.rating.count };
  if (product.price) {
    data.offers = {
      '@type': 'Offer',
      url,
      price: amount(product.price.centAmount, product.price.fractionDigits),
      priceCurrency: product.price.currencyCode,
      availability: product.stock.atBranch ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
    };
  }
  return data;
}
