// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Reads the Malva home banners (custom object container `malva-site`, key `home-banners`, scope view_key_value_documents). A missing object
// or an outage gives no banners: the home page renders without a carousel.
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { MALVA_BANNER_CONTAINER, MALVA_BANNER_KEY, parseMalvaBanners, type MalvaBannerView } from '@/lib/malva-banners';
import { createTtlCache } from '@/lib/ttl-cache';

// The object is the same for every shopper, so one in-memory copy per server instance is safe.
const cache = createTtlCache<unknown>({ ttlMs: 300_000, negativeTtlMs: 30_000 });
const KEY = 'banners';
const statusOf = (error: unknown): number | undefined => (typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined);

async function readValue(): Promise<unknown> {
  const hit = cache.get(KEY);
  if (hit) return hit.value;
  try {
    const { body } = await apiRoot.customObjects().withContainerAndKey({ container: MALVA_BANNER_CONTAINER, key: MALVA_BANNER_KEY }).get().execute();
    cache.set(KEY, body.value);
    return body.value;
  } catch (error) {
    if (statusOf(error) === 404) {
      cache.set(KEY, null);
      return null;
    }
    const stale = cache.getStale(KEY);
    if (stale) return stale.value;
    console.error('[malva-home] banners could not be read');
    return null;
  }
}

/** The home banners in `locale`; `[]` when the object is missing or cannot be read. */
export async function getMalvaBanners(locale: string): Promise<MalvaBannerView[]> {
  return parseMalvaBanners(await readValue(), locale);
}
