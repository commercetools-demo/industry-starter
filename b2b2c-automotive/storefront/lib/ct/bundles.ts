// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Bundle availability and the component list of the product page (workstream W-11). A bundle is sold only while EVERY component is in the
// store's selection and in stock: the portal hides a bundle whose component is withdrawn, but stock is read here, per request.
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { getLineStock } from '@/lib/ct/inventory';
import { bundleUnits, parseBundleContents, type BundleComponent } from '@/lib/bundles/contents';
import type { BundleView } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export { parseBundleContents };

/** The component list with names (the store's tailored names) and how many bundles can be sold. */
export async function getBundleView(storeKey: string, locale: string, components: readonly BundleComponent[], branchChannelId?: string): Promise<BundleView> {
  if (components.length === 0) return { components: [], available: 0 };
  const skus = components.map((c) => c.sku);
  const [selection, stock] = await Promise.all([
    apiRoot
      .productProjections()
      .get({ queryArgs: { storeProjection: storeKey, where: `masterVariant(sku in (${skus.map((s) => `"${s}"`).join(',')}))`, localeProjection: [locale], limit: skus.length } })
      .execute(),
    getLineStock(skus, branchChannelId),
  ]);
  const names = new Map(selection.body.results.map((p) => [p.masterVariant.sku ?? '', getLocalizedString(p.name, locale)]));
  const available: Record<string, number> = {};
  for (const sku of skus) {
    const s = stock.get(sku);
    // A component outside the store's selection counts as 0 whatever its stock.
    available[sku] = names.has(sku) && s ? s.branchQty + s.masterQty : 0;
  }
  return {
    components: components.map((c) => ({ sku: c.sku, qty: c.qty, name: names.get(c.sku) || c.sku, inStore: names.has(c.sku) })),
    available: bundleUnits(components, available),
  };
}

/**
 * Bundles of `product` that can be sold in `storeKey`: the minimum over the components of available quantity divided by `qty`, 0 when a
 * component is not in the store's selection (the product page then shows "Currently unavailable" and disables Add). 0 for a part that is not
 * a bundle. `scope.branchChannelId` adds the shopper's branch to the warehouse stock.
 */
export async function bundleAvailability(storeKey: string, product: Parameters<typeof parseBundleContents>[0], scope: { branchChannelId?: string } = {}): Promise<number> {
  const components = parseBundleContents(product);
  if (!components) return 0;
  return (await getBundleView(storeKey, 'en-US', components, scope.branchChannelId)).available;
}
