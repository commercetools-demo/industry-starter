import type { Money, Price } from '@commercetools-labs/page-builder';
import { COUNTRY_CONFIG } from '@/lib/utils';
import type { ProductSummary } from '@/lib/types';

/**
 * Helpers for components whose settings were typed by an author. Everything an author can type is untrusted: a link is
 * checked before it reaches an `href`, an image must be an https URL, and a price is mapped, not trusted for shape.
 */

export type AuthoredHref = { kind: 'internal'; href: string } | { kind: 'external'; href: string };

const LOCALES = Object.keys(COUNTRY_CONFIG);

/**
 * An internal path (`/category/pods`, locale-less; a leading locale is dropped because `Link` adds it) or an https, http or
 * mailto URL. Anything else (`javascript:`, `data:`, protocol-relative, empty) is not a link.
 */
export function authoredLink(value: unknown): AuthoredHref | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (href === '') return null;
  if (href.startsWith('//')) return null;
  if (href.startsWith('/')) {
    const [first, ...rest] = href.split('/').filter(Boolean);
    if (first !== undefined && LOCALES.includes(first)) return { kind: 'internal', href: `/${rest.join('/')}` };
    return { kind: 'internal', href };
  }
  try {
    const url = new URL(href);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? { kind: 'external', href: url.href } : null;
  } catch {
    return null;
  }
}

/** An https image URL, or undefined. Authors paste URLs; a data: or javascript: value never reaches an image. */
export function authoredImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return new URL(value.trim()).protocol === 'https:' ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** The service's price as the storefront's price line expects it. A discounted price is the one to pay; the list price is struck. */
export function tilePrice(price: Price | null | undefined): ProductSummary['price'] {
  if (!price || typeof price.centAmount !== 'number') return null;
  const pay: Money = price.discounted ?? price;
  return {
    from: { centAmount: pay.centAmount, currencyCode: pay.currencyCode },
    fromIsRange: false,
    ...(price.discounted ? { old: { centAmount: price.centAmount, currencyCode: price.currencyCode } } : {}),
    ...(price.discounted?.discountName ? { discountName: price.discounted.discountName } : {}),
  };
}

/** The product page of a product card, locale-less (`Link` adds the locale). */
export function productHref(product: { slug: string; sku: string }): string {
  return `/p/${encodeURIComponent(product.slug)}/${encodeURIComponent(product.sku)}`;
}

export function categoryHrefOf(slug: string): string {
  return `/category/${encodeURIComponent(slug)}`;
}

/** Items per row from the select field, within what the grid supports. */
export function itemsPerRow(value: unknown, fallback = 4): 2 | 3 | 4 {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return n === 2 || n === 3 || n === 4 ? n : (fallback as 2 | 3 | 4);
}
