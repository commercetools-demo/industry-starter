// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// A real part of the store's assortment for the Product page of the theme preview (workstream U-06, decision 12): a store scoped
// Product Search with `limit: 1` through the frontend client, the same call shape as the top bar search (R-13).
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { devFixturesEnabled } from '@/lib/portal/seam';

/** The slug of one assigned part in the locale, or null when the store has none. */
export async function findPreviewProductSlug(storeKey: string, locale: string): Promise<string | null> {
  if (devFixturesEnabled()) return 'fx-brake-disc-front';
  const { body } = await apiRoot
    .products()
    .search()
    .post({ body: { limit: 1, productProjectionParameters: { storeProjection: storeKey } } })
    .execute();
  const slug = body.results[0]?.productProjection?.slug;
  return slug ? (slug[locale] ?? Object.values(slug)[0] ?? null) : null;
}
