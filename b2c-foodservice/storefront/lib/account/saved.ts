import 'server-only';
import { addPlannedLines, type PlannedLine } from '@/lib/ct/reorder';
import { getCategoryTree } from '@/lib/ct/categories';
import { getStoresForCountry } from '@/lib/ct/channels';
import type { CartMarket } from '@/lib/ct/cart';
import { getListingProjections } from '@/lib/ct/products';
import { findList } from '@/lib/ct/shopping-lists';
import { toSavedList } from '@/lib/mappers/shopping-list';
import { rootCategoryName } from '@/lib/category-tree';
import type { Session } from '@/lib/session';
import type { ProductSummary, SavedAddAllResult, SavedList } from '@/lib/types';
import { marketForCountry } from '@/lib/utils';

/** Cards (price and availability in the shopper's market) for the saved products, keyed by product id. A gone product is absent. */
type List = NonNullable<Awaited<ReturnType<typeof findList>>>;

async function productCards(list: List, session: Session, market: CartMarket): Promise<Map<string, ProductSummary>> {
  const ids = [...new Set(list.lineItems.map((l) => l.productId))];
  if (ids.length === 0) return new Map();
  const collection = marketForCountry(market.country)?.collection ?? false;
  const [tree, stores] = await Promise.all([
    getCategoryTree(market.locale),
    collection ? getStoresForCountry(market.country, market.locale).catch(() => []) : Promise.resolve([]),
  ]);
  const store = stores.find((s) => s.key === session.collectionStoreKey);
  const cards = await getListingProjections(ids, {
    locale: market.locale, country: market.country, currency: market.currency,
    ...(store ? { storeChannelId: store.id } : {}),
    categoryName: (categoryIds: string[]) => rootCategoryName(tree, categoryIds),
  });
  return new Map(cards.map((c) => [c.id, c]));
}

/**
 * The saved list as a view: lines newest first. `withProducts: false` skips the product read (cheap, for the hearts, which
 * only need ids). Prices come from the product read, never from the list (a list line has no price).
 */
export async function loadSavedList(
  customerId: string,
  session: Session,
  market: CartMarket,
  { withProducts }: { withProducts: boolean },
): Promise<SavedList | null> {
  const list = await findList(customerId);
  if (!list) return null;
  return toSavedList(list, market.locale, withProducts ? await productCards(list, session, market) : new Map());
}

/**
 * Add all to bag: one `addLine` per saved product (delivery; the list's `addShoppingList` cart action cannot set the line's
 * fulfilment or check stock). Lines that fail are collected as `skipped` with a reason, the others are in the bag, and the
 * list itself is not changed.
 */
export async function addAllToBag(
  customerId: string,
  session: Session,
  market: CartMarket,
): Promise<{ result: SavedAddAllResult; session: Session } | null> {
  const list = await findList(customerId);
  if (!list || list.lineItems.length === 0) return null;
  const cards = await productCards(list, session, market);
  const plan: PlannedLine[] = [];
  const bySku = new Map<string, string>();
  const unresolved: SavedAddAllResult['skipped'] = [];
  for (const line of list.lineItems) {
    const name = (line.name as Record<string, string>)[market.locale] ?? Object.values(line.name as Record<string, string>)[0] ?? '';
    const sku = line.variant?.sku ?? cards.get(line.productId)?.sku;
    if (!sku || !line.published || !cards.has(line.productId)) {
      unresolved.push({ productId: line.productId, name, reason: cards.has(line.productId) ? 'unavailable' : 'not_found' });
      continue;
    }
    bySku.set(sku, line.productId);
    plan.push({ sku, name: cards.get(line.productId)?.name ?? name, quantity: 1, ordered: 'delivery', fulfilment: 'delivery' });
  }
  const { result, session: next } = await addPlannedLines(session, market, plan);
  return {
    result: {
      added: result.added,
      skipped: [...unresolved, ...result.skipped.map((s) => ({ productId: bySku.get(s.sku) ?? '', name: s.name, reason: s.reason }))],
      cart: result.cart,
    },
    session: next,
  };
}
