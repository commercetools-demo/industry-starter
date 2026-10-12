// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Render-time sizing of product photos (D-021: stored image URLs are clean, sizing parameters are added when rendering).
// Used as the `loader` of `next/image`, so no image host has to be registered with the optimizer; the browser loads the photo
// from its host, which therefore must be listed in `CSP_IMG_HOSTS` (see .env.example).

const PEXELS_HOST = 'images.pexels.com';

export function productImageLoader({ src, width }: { src: string; width: number }): string {
  try {
    const url = new URL(src);
    if (url.hostname === PEXELS_HOST && !url.search) return `${url.origin}${url.pathname}?auto=compress&cs=tinysrgb&w=${width}`;
  } catch {
    // a relative or malformed value is used as stored
  }
  return src;
}
