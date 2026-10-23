import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { mapProductSummary, type SummaryContext } from '@/lib/mappers/product-summary';
import type { ProductSummary } from '@/lib/types';

const KEY = /^[A-Za-z0-9_-]{2,256}$/;

/**
 * One published product by its key, as a card view model with the shopper's price (workstream O, the hero card).
 * Not cached: prices are per market. null for a bad key, an unpublished product (404) and a product without a price in
 * this market is returned as is (the caller decides); any other failure throws.
 */
export async function getProductSummaryByKey(key: string, ctx: Omit<SummaryContext, 'matchedSku'>): Promise<ProductSummary | null> {
  if (!KEY.test(key)) return null;
  try {
    const { body } = await apiRoot
      .productProjections()
      .withKey({ key })
      .get({
        queryArgs: {
          staged: false,
          priceCurrency: ctx.currency,
          priceCountry: ctx.country,
          localeProjection: [ctx.locale],
          expand: ['masterVariant.price.discounted.discount', 'variants[*].price.discounted.discount'],
        },
      })
      .execute();
    return mapProductSummary(body, ctx);
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}
