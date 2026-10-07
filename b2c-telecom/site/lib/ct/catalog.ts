import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { unstable_cache } from 'next/cache';
import { CATALOG_TTL, PRODUCT_TYPE_IDS_TTL } from '@/lib/config/cache';
import { findDescendantKeys, flattenTree } from '@/lib/mappers/category';
import { mapFacts, mapOffer, mergeFacts } from '@/lib/mappers/offer';
import type { Locale, Market, Offer, OfferFacts } from '@/lib/types';
import { getCategoryTree } from './categories';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

export const OFFER_TYPE_KEY = 'malva-offer';
export const FACT_TYPE_KEYS = ['malva-internet-plan', 'malva-phone-plan', 'malva-addon', 'malva-equipment', 'malva-device'] as const;
const ALL_TYPE_KEYS = [OFFER_TYPE_KEY, ...FACT_TYPE_KEYS];
const PAGE_LIMIT = 500;

// Everything cached here is shared between buyers (the catalog is identical for every buyer, D-058): no session data inside.
const CACHE_TAGS = ['catalog'];

/** Product type key to id (`where` on projections takes ids, never keys). */
export async function getProductTypeIds(): Promise<Record<string, string>> {
  const read = unstable_cache(
    async (): Promise<Record<string, string>> => {
      const where = `key in (${ALL_TYPE_KEYS.map((key) => `"${key}"`).join(',')})`;
      const { body } = await withTimeout(getApiRoot().productTypes().get({ queryArgs: { where, limit: 10 } }).execute(), 'catalog.product-types');
      const ids: Record<string, string> = {};
      for (const type of body.results) if (type.key) ids[type.key] = type.id;
      return ids;
    },
    ['product-type-ids'],
    { revalidate: PRODUCT_TYPE_IDS_TTL, tags: CACHE_TAGS },
  );
  return read();
}

/** Reads every published projection matching `where`, page by page until `total` is reached. */
async function readAllProjections(where: string, label: string, extra: { priceCurrency?: string; priceCountry?: string } = {}): Promise<ProductProjection[]> {
  const all: ProductProjection[] = [];
  let offset = 0;
  for (;;) {
    const { body } = await withTimeout(
      getApiRoot()
        .productProjections()
        .get({ queryArgs: { where, limit: PAGE_LIMIT, offset, staged: false, ...extra } })
        .execute(),
      label,
    );
    all.push(...body.results);
    offset += body.results.length;
    if (body.results.length === 0 || offset >= (body.total ?? 0)) return all;
  }
}

/** Facts of every descriptive (non-offer) product, keyed by product key. */
export async function getCatalogFacts(locale: Locale): Promise<Record<string, OfferFacts>> {
  const read = unstable_cache(
    async (): Promise<Record<string, OfferFacts>> => {
      const ids = await getProductTypeIds();
      const keyById = new Map(FACT_TYPE_KEYS.flatMap((key) => (ids[key] ? [[ids[key], key] as const] : [])));
      if (keyById.size === 0) return {};
      const where = `productType(id in (${[...keyById.keys()].map((id) => `"${id}"`).join(',')}))`;
      const facts: Record<string, OfferFacts> = {};
      for (const projection of await readAllProjections(where, 'catalog.facts')) {
        const typeKey = keyById.get(projection.productType.id);
        const mapped = typeKey && projection.key ? mapFacts(projection, typeKey, locale) : null;
        if (mapped && projection.key) facts[projection.key] = mapped;
      }
      return facts;
    },
    ['catalog-facts', locale],
    { revalidate: CATALOG_TTL, tags: CACHE_TAGS },
  );
  return read();
}

/** Every sellable offer of the market, priced for it. Offers without facts or without a market price are hidden and logged. */
export async function getAllOffers(market: Market): Promise<Offer[]> {
  const read = unstable_cache(
    async (): Promise<Offer[]> => {
      const [ids, tree, facts] = await Promise.all([getProductTypeIds(), getCategoryTree(market.locale), getCatalogFacts(market.locale)]);
      const offerTypeId = ids[OFFER_TYPE_KEY];
      if (!offerTypeId) throw new Error(`Product type ${OFFER_TYPE_KEY} not found`);
      const categoryIdToKey = Object.fromEntries(flattenTree(tree).map((category) => [category.id, category.key]));
      const projections = await readAllProjections(`productType(id="${offerTypeId}")`, 'catalog.offers', {
        priceCurrency: market.currency,
        priceCountry: market.country,
      });
      const now = new Date();
      const offers: Offer[] = [];
      for (const projection of projections) {
        const mapped = mapOffer(projection, { market, categoryIdToKey, now });
        if (!mapped) continue;
        const offer = mergeFacts(mapped, facts);
        if (offer.facts === null) {
          console.warn('[catalog] offer hidden', offer.key, 'anchor product missing');
        } else if (!offer.headline.recurring && !offer.headline.oneTime) {
          console.warn('[catalog] offer hidden', offer.key, `no price for ${market.currency}/${market.country}`);
        } else {
          offers.push(offer);
        }
      }
      return offers;
    },
    ['offers', market.locale, market.currency, market.country],
    { revalidate: CATALOG_TTL, tags: CACHE_TAGS },
  );
  return read();
}

/** `null` for an unknown, unpublished or hidden offer. */
export async function getOfferByKey(key: string, market: Market): Promise<Offer | null> {
  return (await getAllOffers(market)).find((offer) => offer.key === key) ?? null;
}

/** In the order of `keys`; unknown keys are skipped. */
export async function getOffersByKeys(keys: readonly string[], market: Market): Promise<Offer[]> {
  const byKey = new Map((await getAllOffers(market)).map((offer) => [offer.key, offer]));
  return [...new Set(keys)].flatMap((key) => {
    const offer = byKey.get(key);
    return offer ? [offer] : [];
  });
}

/** Offers assigned to the category or any of its descendants (the add-ons root shows streaming, equipment and protection). */
export async function getOffersInCategory(categoryKey: string, market: Market): Promise<Offer[]> {
  const [offers, tree] = await Promise.all([getAllOffers(market), getCategoryTree(market.locale)]);
  const category = flattenTree(tree).find((candidate) => candidate.key === categoryKey);
  if (!category) return [];
  const keys = new Set(findDescendantKeys(category));
  return offers.filter((offer) => offer.categoryKeys.some((key) => keys.has(key)));
}
