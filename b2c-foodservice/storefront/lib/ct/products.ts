import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { mapProductSummary, type SummaryContext } from '@/lib/mappers/product-summary';
import type { ProductSummary } from '@/lib/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProjectionContext extends Omit<SummaryContext, 'matchedSku'> {
  /** product id to matched SKU (from the search response). */
  matchedSkus?: Record<string, string>;
}

/**
 * Second half of the id-first read: Product Search returned ids, this reads them as projections with the shopper's
 * embedded price (priceCurrency, priceCountry) and the display locale, maps them to card view models and puts them back
 * in the search order (the API does not guarantee it). Not cached: prices and availability are per market and shopper.
 * A projection that is gone (unpublished since the search) is skipped; no ids means no call.
 * Ids are checked as UUIDs before they enter the predicate.
 */
export async function getListingProjections(ids: string[], ctx: ProjectionContext): Promise<ProductSummary[]> {
  const valid = ids.filter((id) => UUID.test(id));
  if (valid.length === 0) return [];
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `id in (${valid.map((i) => `"${i}"`).join(',')})`,
        staged: false,
        limit: valid.length,
        priceCurrency: ctx.currency,
        priceCountry: ctx.country,
        localeProjection: [ctx.locale],
        expand: ['masterVariant.price.discounted.discount', 'variants[*].price.discounted.discount'],
      },
    })
    .execute();
  const byId = new Map(body.results.map((p) => [p.id, p]));
  const out: ProductSummary[] = [];
  for (const id of valid) {
    const projection = byId.get(id);
    if (!projection) continue;
    const matchedSku = ctx.matchedSkus?.[id];
    out.push(mapProductSummary(projection, { ...ctx, ...(matchedSku ? { matchedSku } : {}) }));
  }
  return out;
}
