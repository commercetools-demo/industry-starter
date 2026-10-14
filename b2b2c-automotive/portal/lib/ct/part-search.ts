import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { buildPartSearchBody, OE_ATTRIBUTE } from '@/lib/portal/search';
import type { PartHit } from '@/lib/portal/types';
import { getLocalizedString } from '@/lib/utils';

/**
 * Product Search for the top bar and palette (R-13), scoped to the store through the store projection. Exact SKU, part
 * number and OE number plus a name full text match; at most eight parts.
 * Live check M-R-3: confirm the store assortment is applied (the project-level search has no in-store variant in the SDK).
 */
export async function searchParts(storeKey: string, q: string, locale: string): Promise<PartHit[]> {
  const language = locale.split('-')[0];
  const { body } = await apiRoot
    .products()
    .search()
    .post({ body: { ...buildPartSearchBody(q, language), productProjectionParameters: { storeProjection: storeKey } } })
    .execute();
  return body.results.flatMap((result) => {
    const projection = result.productProjection;
    if (!projection) return [];
    const variants = [projection.masterVariant, ...(projection.variants ?? [])];
    const wanted = q.toLowerCase();
    const oeOf = (v: (typeof variants)[number]) => {
      const raw = v.attributes?.find((a) => a.name === OE_ATTRIBUTE)?.value;
      return Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? [raw] : [];
    };
    const variant = variants.find((v) => v.sku?.toLowerCase() === wanted || oeOf(v).some((o) => o.toLowerCase() === wanted)) ?? projection.masterVariant;
    if (!variant.sku) return [];
    const oe = oeOf(variant).find((o) => o.toLowerCase() === wanted) ?? oeOf(variant)[0];
    return [{ sku: variant.sku, name: getLocalizedString(projection.name, locale), ...(oe ? { oe } : {}) }];
  });
}
