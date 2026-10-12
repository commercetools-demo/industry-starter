// Bundles (W-09, D4): one product of the seed product type `mau-pt-bundle` that lists its components (`component-skus`,
// `component-quantities` as `<sku>:<qty>`, `bundle-discount-percent`, `owner-store`). Components must be assigned to the store
// (`isAssigned`); the bundle price is ONE standalone price on the store's distribution channel written by T's price writer
// (`setStandalonePrice`), never an embedded price. A bundle is created unpublished (Draft). It enters the store's product selection
// when it is published (an unpublished product cannot be assigned: the assortment reads published projections), and it leaves it
// again while any component is not assigned (`reconcileBundles`, called after every assortment change and when the list loads).
import 'server-only';
import type { BundleComponentView, BundleView, BundleInput, ComponentOption } from '@/lib/w-types';
import type { ProductDraft, ProductProjection } from '@commercetools/platform-sdk';
import { bundlePrice } from '@/lib/bundles/price';
import { validateBundle, type BundleDraft } from '@/lib/bundles/rules';
import { CatalogError } from '@/lib/catalog/errors';
import { slugify } from '@/lib/import/local-product';
import { isAssigned } from './assortment';
import { assignProducts } from './assortment-write';
import { clearCatalogCaches, hydrateBySkus, selectionProductIds } from './catalog-data';
import { getRetailPrice, listPrices, setStandalonePrice } from './prices';
import { getSellerStore } from './store-info';
import { retryOnConflict } from './versioned';
import { listOwnProducts, textSetAttribute } from './w-products';
import { wRoot } from './w-root';

export type { BundleComponentView, BundleView, BundleInput, ComponentOption };

export const BUNDLE_TYPE = 'mau-pt-bundle';

const skuPart = (storeKey: string) => storeKey.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseQuantities(values: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of values) {
    const at = v.lastIndexOf(':');
    const qty = Number(v.slice(at + 1));
    if (at > 0 && Number.isInteger(qty) && qty > 0) out.set(v.slice(0, at), qty);
  }
  return out;
}

function componentsOf(p: ProductProjection): { sku: string; qty: number }[] {
  const qty = parseQuantities(textSetAttribute(p, 'component-quantities'));
  return textSetAttribute(p, 'component-skus').map((sku) => ({ sku, qty: qty.get(sku) ?? 1 }));
}

async function toView(storeKey: string, p: ProductProjection): Promise<BundleView> {
  const comps = componentsOf(p);
  const infos = await hydrateBySkus(comps.map((c) => c.sku));
  const components: BundleComponentView[] = [];
  for (const c of comps) {
    const price = await getRetailPrice(storeKey, c.sku);
    components.push({ sku: c.sku, name: infos.get(c.sku)?.name ?? {}, qty: c.qty, retailCents: price?.centAmount ?? null, assigned: await isAssigned(storeKey, c.sku) });
  }
  const sku = p.masterVariant.sku ?? '';
  const price = sku ? await getRetailPrice(storeKey, sku) : null;
  const componentsCents = components.reduce((n, c) => n + (c.retailCents ?? 0) * c.qty, 0);
  return {
    key: p.key ?? p.id,
    productId: p.id,
    sku,
    name: { ...(p.name ?? {}) },
    discountPercent: Number(p.masterVariant.attributes?.find((a) => a.name === 'bundle-discount-percent')?.value ?? 0),
    components,
    componentsCents,
    bundleCents: price?.centAmount ?? null,
    savingCents: price ? componentsCents - price.centAmount : null,
    status: p.published ? 'Live' : 'Draft',
    unavailableSku: components.find((c) => !c.assigned)?.sku ?? null,
  };
}

/** The store's bundles. Reconciles first, so a bundle whose component was withdrawn is already out of the selection. */
export async function listBundles(storeKey: string): Promise<BundleView[]> {
  await reconcileBundles(storeKey);
  const products = await listOwnProducts(BUNDLE_TYPE, storeKey);
  const views = await Promise.all(products.map((p) => toView(storeKey, p)));
  return views.sort((a, b) => a.sku.localeCompare(b.sku));
}

const nextNumber = (skus: string[]): number => skus.reduce((max, s) => Math.max(max, Number(/-(\d+)$/.exec(s)?.[1] ?? 0)), 0) + 1;

/** Creates the Draft bundle and its standalone price. 409 `COMPONENT_NOT_ASSIGNED` names the first SKU outside the assortment. */
export async function createBundle(storeKey: string, input: BundleInput): Promise<BundleView> {
  const draft: BundleDraft = { name: input.name.trim(), discountPercent: input.discountPercent, components: input.components };
  for (const c of draft.components) {
    if (c.sku.startsWith('BND-') || !(await isAssigned(storeKey, c.sku))) throw new CatalogError(409, 'COMPONENT_NOT_ASSIGNED', `${c.sku} is not in this store's assortment`, { sku: c.sku });
  }
  const retail = new Map<string, number | null>();
  for (const c of draft.components) retail.set(c.sku, (await getRetailPrice(storeKey, c.sku))?.centAmount ?? null);
  const priced = bundlePrice(draft.components.map((c) => ({ retailCents: retail.get(c.sku) ?? 0, qty: c.qty })), draft.discountPercent);
  const issues = validateBundle(draft, retail, priced.bundleCents);
  if (issues.length) throw new CatalogError(400, issues[0].code, issues[0].message, { issues, ...(issues[0].sku ? { sku: issues[0].sku } : {}) });

  const [store, existing] = await Promise.all([getSellerStore(storeKey), listOwnProducts(BUNDLE_TYPE, storeKey)]);
  const sku = `BND-${skuPart(storeKey)}-${String(nextNumber(existing.map((p) => p.masterVariant.sku ?? ''))).padStart(3, '0')}`;
  const slug = slugify(`${draft.name}-${sku}`);
  const infos = await hydrateBySkus([draft.components[0].sku]);
  const categories = (infos.get(draft.components[0].sku)?.categoryIds ?? []).slice(0, 5).map((id) => ({ typeId: 'category' as const, id }));
  const languages = store.languages.length ? store.languages : ['de-DE', 'en-US'];
  const body: ProductDraft = {
    productType: { typeId: 'product-type', key: BUNDLE_TYPE },
    key: `bundle-${storeKey}-${slugify(draft.name)}-${sku.slice(-3)}`,
    name: Object.fromEntries(languages.map((l) => [l, draft.name])),
    slug: Object.fromEntries(languages.map((l) => [l, slug])),
    categories,
    priceMode: 'Standalone',
    masterVariant: {
      sku,
      attributes: [
        { name: 'part-number', value: sku },
        { name: 'component-skus', value: draft.components.map((c) => c.sku) },
        { name: 'component-quantities', value: draft.components.map((c) => `${c.sku}:${c.qty}`) },
        { name: 'bundle-discount-percent', value: draft.discountPercent },
        { name: 'owner-store', value: storeKey },
      ],
    },
    publish: false,
  };
  const root = await wRoot();
  try {
    await root.products().post({ body }).execute();
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) throw new CatalogError(409, 'BUNDLE_EXISTS', 'A bundle with this name already exists');
    throw error;
  }
  await setStandalonePrice(storeKey, sku, undefined, priced.bundleCents);
  const created = (await listOwnProducts(BUNDLE_TYPE, storeKey)).find((p) => p.masterVariant.sku === sku);
  return toView(storeKey, created as ProductProjection);
}

/** Re-checks the components and the price, publishes, and puts the bundle into the store's selection. */
export async function publishBundle(storeKey: string, key: string): Promise<BundleView> {
  const own = (await listOwnProducts(BUNDLE_TYPE, storeKey)).find((p) => p.key === key);
  if (!own) throw new CatalogError(404, 'BUNDLE_NOT_FOUND', 'Not found'); // also for another store's bundle
  const view = await toView(storeKey, own);
  if (view.unavailableSku) throw new CatalogError(409, 'COMPONENT_NOT_ASSIGNED', `${view.unavailableSku} is not in this store's assortment`, { sku: view.unavailableSku });
  const missing = view.components.find((c) => !(c.retailCents && c.retailCents > 0));
  if (missing) throw new CatalogError(409, 'COMPONENT_PRICE', 'A component has no price above zero', { sku: missing.sku });
  if (!(view.bundleCents && view.bundleCents > 0)) throw new CatalogError(409, 'BUNDLE_PRICE', 'The bundle has no price above zero');
  const root = await wRoot();
  if (!own.published) {
    await retryOnConflict(async () => {
      const current = (await root.products().withKey({ key }).get().execute()).body;
      await root.products().withKey({ key }).post({ body: { version: current.version, actions: [{ action: 'publish' }] } }).execute();
    });
  }
  clearCatalogCaches();
  await assignProducts(storeKey, [own.id]);
  const after = (await listOwnProducts(BUNDLE_TYPE, storeKey)).find((p) => p.key === key);
  return toView(storeKey, after as ProductProjection);
}

async function updateSelection(selectionKey: string, action: 'addProduct' | 'removeProduct', productId: string): Promise<void> {
  const root = await wRoot();
  await retryOnConflict(async () => {
    const selection = (await root.productSelections().withKey({ key: selectionKey }).get().execute()).body;
    await root.productSelections().withId({ ID: selection.id }).post({ body: { version: selection.version, actions: [{ action, product: { typeId: 'product', id: productId } }] } }).execute();
  });
  clearCatalogCaches();
}

/**
 * A published bundle is in the store's selection exactly while every component is assigned. A component that was withdrawn
 * removes the bundle from the selection (it is hidden in the storefront); reinstating the component puts it back.
 */
export async function reconcileBundles(storeKey: string): Promise<{ hidden: string[]; restored: string[] }> {
  const [store, products] = await Promise.all([getSellerStore(storeKey), listOwnProducts(BUNDLE_TYPE, storeKey)]);
  const result = { hidden: [] as string[], restored: [] as string[] };
  const published = products.filter((p) => p.published);
  if (published.length === 0) return result;
  const inSelection = await selectionProductIds(store.selection.key);
  for (const p of published) {
    let allAssigned = true;
    for (const c of componentsOf(p)) if (!(await isAssigned(storeKey, c.sku))) allAssigned = false;
    const key = p.key ?? p.id;
    if (!allAssigned && inSelection.has(p.id)) {
      await updateSelection(store.selection.key, 'removeProduct', p.id);
      result.hidden.push(key);
    } else if (allAssigned && !inSelection.has(p.id)) {
      await updateSelection(store.selection.key, 'addProduct', p.id);
      result.restored.push(key);
    }
  }
  return result;
}

/** Assigned parts of the store with the retail price a shopper pays (the store's own price, else the Malva list price), for the picker. */
export async function listComponentOptions(storeKey: string, text?: string): Promise<ComponentOption[]> {
  const page = await listPrices(storeKey, { text, offset: 0, limit: 100, currency: 'EUR' });
  return page.rows
    .filter((r) => !r.sku.startsWith('BND-'))
    .map((r) => ({ sku: r.sku, name: r.name, retailCents: r.overrideCent ?? r.listCent ?? 0 }))
    .filter((c) => c.retailCents > 0);
}
