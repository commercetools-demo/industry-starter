// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// URLs of the storefront pages in the theme preview (workstream U-06, decision 12). Path templates are copied from the route files
// and plans of the storefront: home `app/[locale]/[store]/page.tsx`, listing `.../parts` (workstream L), product `.../p/[slug]`
// (M-03), cart `.../cart` (N), checkout `.../checkout` (O). Pure.
export const PREVIEW_PAGES = ['home', 'listing', 'product', 'cart', 'checkout'] as const;
export type PreviewPageId = (typeof PREVIEW_PAGES)[number];

/** Path of a page below `/{locale}/{store}`, or null for a product when no slug is known. */
export function previewPath(id: PreviewPageId, productSlug?: string | null): string | null {
  switch (id) {
    case 'home':
      return '';
    case 'listing':
      return '/parts';
    case 'product':
      return productSlug && /^[A-Za-z0-9_-]+$/.test(productSlug) ? `/p/${productSlug}` : null;
    case 'cart':
      return '/cart';
    case 'checkout':
      return '/checkout';
  }
}

/** Absolute URL of a preview page; null when the page has no path. */
export function previewUrl(origin: string, locale: string, storeKey: string, id: PreviewPageId, productSlug?: string | null): string | null {
  const path = previewPath(id, productSlug);
  return path === null ? null : `${origin}/${locale}/${storeKey}${path}`;
}

export interface PreviewPageStatus {
  id: PreviewPageId;
  url: string | null;
  /** False when the storefront answers 404 (route not built yet) or cannot be reached. */
  available: boolean;
}

/** The widths of the preview frame (decision 12): desktop is scaled down to the card, phone is 375 px. */
export const PREVIEW_WIDTHS = { desktop: 1280, phone: 375 } as const;
