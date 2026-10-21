import 'server-only';
import type { ProductProjection, ProductSearchRequest } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { SKU_PATTERN } from '@/lib/ct/inventory';
import { cachedPublic } from '@/lib/ct/public-cache';
import { mapRecurrencePolicy } from '@/lib/mappers/recurrence-policy';
import type { RecurrencePolicyView } from '@/lib/types';

export interface DetailReadContext { locale: string; country: string; currency: string }

/**
 * Product page read (workstream H, 3.3): SKU to product id with Product Search (exact on `variants.sku`, never the
 * slug), then the projection with the shopper's embedded price. `recurrencePrices` arrive on their own and must not be
 * added to `expand`. An invalid SKU (not matching SKU_PATTERN) returns null before any call; an unknown or unpublished
 * product returns null. Never cached: prices are per market and shopper.
 */
export async function getProductBySku(sku: string, ctx: DetailReadContext): Promise<ProductProjection | null> {
  if (!SKU_PATTERN.test(sku)) return null;
  const search = await apiRoot
    .products()
    .search()
    .post({ body: { query: { exact: { field: 'variants.sku', value: sku } }, limit: 1 } as unknown as ProductSearchRequest })
    .execute();
  const id = (search.body as unknown as { results: { id: string }[] }).results[0]?.id;
  if (!id) return null;
  try {
    const { body } = await apiRoot
      .productProjections()
      .withId({ ID: id })
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
    return body;
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}

async function fetchRecurrencePolicies(locale: string): Promise<RecurrencePolicyView[]> {
  const { body } = await apiRoot.recurrencePolicies().get({ queryArgs: { limit: 100 } }).execute();
  return body.results.map((p) => mapRecurrencePolicy(p, locale)).filter((p): p is RecurrencePolicyView => p !== null);
}

/** Recurrence policies for the subscribe interval list. Public and stable: cached 300 s (tag `recurrence-policies`). */
export const getRecurrencePolicies: (locale: string) => Promise<RecurrencePolicyView[]> = cachedPublic(
  'recurrencePolicies',
  ['recurrence-policies'],
  fetchRecurrencePolicies,
);

/** Policy by key for the add-to-bag check; null when it does not exist. */
export async function getRecurrencePolicyByKey(key: string, locale: string): Promise<RecurrencePolicyView | null> {
  try {
    const { body } = await apiRoot.recurrencePolicies().withKey({ key }).get().execute();
    return mapRecurrencePolicy(body, locale);
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return null;
    throw e;
  }
}
