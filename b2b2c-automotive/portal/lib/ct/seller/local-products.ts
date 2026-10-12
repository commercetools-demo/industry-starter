// Local products (W-12, W-15, D6): reseller-owned parts of the seed product type `mau-pt-local-part` (no fitment attribute). The
// price is a standalone price written by T's price writer. A product WITHOUT a fitment claim is published at once with
// `review-state=approved` and put into the store selection. A product WITH a claim is created UNPUBLISHED with
// `review-state=pending`, stays out of every selection, and the claimed vehicles live only in the review record
// `malva-local-review` / `<storeKey>--<productKey>` until Malva approves it in the Merchant Center (Q-W08). The reseller can
// never publish a claim: there is no code path that does.
import 'server-only';
import type { VehicleOption, LocalProductResult, LocalStatus, LocalProductRow } from '@/lib/w-types';
import type { ProductDraft } from '@commercetools/platform-sdk';
import { CatalogError } from '@/lib/catalog/errors';
import { LOCALES, slugify, validateLocalProduct, type Locale, type LocalProductInput } from '@/lib/import/local-product';
import { localProductKey } from '@/lib/import/validate';
import { assignProducts } from './assortment-write';
import { ASSORTMENT_CONTAINER, clearCatalogCaches, listCategories, readAssortmentObject } from './catalog-data';
import { listPricesBySku, setStandalonePrice } from './prices';
import { getSellerStore } from './store-info';
import { retryOnConflict } from './versioned';
import { CONTAINERS, listObjects, readObject, storeObjectKey, upsertObject } from './w-objects';
import { listOwnProducts, skuExists, textAttribute } from './w-products';
import { wRoot } from './w-root';

export type { VehicleOption, LocalProductResult, LocalStatus, LocalProductRow };

export const LOCAL_TYPE = 'mau-pt-local-part';

/** The vehicle table the finder uses (container `mau-vehicles`); the claim can only name keys from it. */
export async function listVehicleOptions(): Promise<VehicleOption[]> {
  const objects = await listObjects<{ fitmentKey?: unknown; make?: unknown; model?: unknown; generation?: unknown; engine?: unknown; yearFrom?: unknown; yearTo?: unknown }>('mau-vehicles');
  return objects
    .filter((o) => typeof o.value.fitmentKey === 'string')
    .map((o) => ({ fitmentKey: o.value.fitmentKey as string, label: `${o.value.make} ${o.value.model} ${o.value.generation ?? ''} ${o.value.engine ?? ''} (${o.value.yearFrom}-${o.value.yearTo})`.replace(/\s+/g, ' ') }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function createLocalProduct(storeKey: string, input: LocalProductInput): Promise<LocalProductResult> {
  const [store, categories] = await Promise.all([getSellerStore(storeKey), listCategories()]);
  const languages = store.languages.filter((l): l is Locale => (LOCALES as readonly string[]).includes(l));
  const issues = validateLocalProduct(input, { languages: languages.length ? languages : [...LOCALES], categoryKeys: new Set(categories.map((c) => c.key)) });
  if (issues.length) throw new CatalogError(400, 'INVALID_FIELD', issues[0].message, { field: issues[0].field, issues });

  const claimed = [...new Set(input.fitment ?? [])];
  if (claimed.length) {
    const known = new Set((await listVehicleOptions()).map((v) => v.fitmentKey));
    const unknown = claimed.find((k) => !known.has(k));
    if (unknown) throw new CatalogError(400, 'INVALID_FIELD', 'Choose vehicles from the list', { field: 'fitment' });
  }
  if (await skuExists(input.sku)) throw new CatalogError(409, 'SKU_IN_USE', 'SKU already in use', { field: 'sku' });

  const category = categories.find((c) => c.key === input.categoryKey) as (typeof categories)[number];
  const claim = claimed.length > 0;
  const key = localProductKey(storeKey, input.sku);
  const names = Object.fromEntries(languages.map((l) => [l, (input.name[l] ?? '').trim()]));
  const body: ProductDraft = {
    productType: { typeId: 'product-type', key: LOCAL_TYPE },
    key,
    name: names,
    slug: Object.fromEntries(Object.entries(names).map(([l, n]) => [l, slugify(`${n} ${input.sku}`) || slugify(input.sku)])),
    categories: [{ typeId: 'category', id: category.id }],
    priceMode: 'Standalone',
    masterVariant: {
      sku: input.sku,
      attributes: [
        { name: 'part-number', value: input.sku },
        ...(input.brandName?.trim() ? [{ name: 'brand-name', value: input.brandName.trim() }] : []),
        { name: 'owner-store', value: storeKey },
        { name: 'review-state', value: claim ? 'pending' : 'approved' },
      ],
    },
    publish: !claim,
  };
  const root = await wRoot();
  let productId: string;
  try {
    productId = (await root.products().post({ body }).execute()).body.id;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) throw new CatalogError(409, 'SKU_IN_USE', 'SKU already in use', { field: 'sku' });
    throw error;
  }
  await setStandalonePrice(storeKey, input.sku, undefined, input.priceCents);
  if (!claim) {
    clearCatalogCaches();
    await assignProducts(storeKey, [productId]);
  } else {
    await upsertObject(CONTAINERS.localReview, storeObjectKey(storeKey, key), () => ({ state: 'pending', storeKey, productKey: key, sku: input.sku, claimedVehicles: claimed, createdAt: new Date().toISOString() }));
    await markPendingReview(storeKey, input.sku);
  }
  return { key, sku: input.sku, productId, status: claim ? 'pending' : 'live' };
}

/** Lists the SKU in `mau-assortment/<store>.pendingReview` (as the seeded SK-2002 is), so the assortment shows it as awaiting review. */
async function markPendingReview(storeKey: string, sku: string): Promise<void> {
  const root = await wRoot();
  await retryOnConflict(async () => {
    const { value, version } = await readAssortmentObject(storeKey);
    if (value.pendingReview.includes(sku)) return;
    const next = { ...value, pendingReview: [...value.pendingReview, sku] };
    await root.customObjects().post({ body: { container: ASSORTMENT_CONTAINER, key: storeKey, value: next as never, ...(version !== undefined ? { version } : {}) } }).execute();
  });
}

export const statusOf = (reviewState: string | undefined, published: boolean): LocalStatus => (reviewState === 'rejected' ? 'Rejected' : reviewState === 'pending' ? 'Awaiting review' : published ? 'Live' : 'Awaiting review');

export async function listLocalProducts(storeKey: string): Promise<LocalProductRow[]> {
  const products = await listOwnProducts(LOCAL_TYPE, storeKey);
  const prices = await listPricesBySku(storeKey, products.map((p) => p.masterVariant.sku ?? ''));
  const rows: LocalProductRow[] = [];
  for (const p of products) {
    const key = p.key ?? p.id;
    const sku = p.masterVariant.sku ?? '';
    const review = await readObject<{ storeKey?: string; claimedVehicles?: unknown }>(CONTAINERS.localReview, storeObjectKey(storeKey, key));
    rows.push({
      key,
      sku,
      name: { ...(p.name ?? {}) },
      priceCents: prices.get(sku)?.centAmount ?? null,
      status: statusOf(textAttribute(p, 'review-state'), p.published === true),
      claimedVehicles: review?.value.storeKey === storeKey && Array.isArray(review.value.claimedVehicles) ? (review.value.claimedVehicles as unknown[]).filter((v): v is string => typeof v === 'string') : [],
    });
  }
  return rows.sort((a, b) => a.sku.localeCompare(b.sku));
}
