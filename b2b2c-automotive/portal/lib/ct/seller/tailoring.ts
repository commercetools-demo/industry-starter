// Product info and image tailoring (T-07). Tailoring uses commercetools Product Tailoring in the reseller store. A save writes
// the staged changes and publishes in the SAME update request: tailored text and images are live at once, there is no pending
// state, no review and no approval (owner Q-T06, Q-004). Tailorable: name, description, images of the master variant.
//
// Localisation (T-07 acceptance): a tailored locale-keyed field replaces the whole localized string, so a save fills every
// store language that was not tailored with the master text. A locale counts as tailored when its text differs from the
// master text; `tailoredLocales` is derived that way and needs no extra storage. Live check M-T-5 confirms the projection.
import 'server-only';
import type { Image, ProductTailoring } from '@commercetools/platform-sdk';
import { CatalogError } from '@/lib/catalog/errors';
import { fetchImageFromUrl } from '@/lib/catalog/image-url';
import type { TailoringFields } from '@/lib/catalog/tailoring-schema';
import type { ImageRef, LocalizedText, TailoringDetail, TailoringRow } from '@/lib/catalog/types';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { assignedBySku, loadMembers } from './assortment-members';
import type { ProductInfo } from './catalog-data';
import { catalogRoot } from './catalog-root';
import { getSellerStore } from './store-info';
import { isNotFound, retryOnConflict } from './versioned';

export interface TailoringDeps {
  /** Dimensions of an image URL the editor sends (fetched and validated by the server; stubbed in development fixtures). */
  probe: (url: string) => Promise<{ width: number; height: number }>;
}

/** A tiny PNG header of the given size: what the development fixture mode "downloads" so no network is needed. */
function syntheticPng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

/**
 * Fetches and validates a pasted image URL (SSRF guard, size and format limits). In the development fixture mode the same checks
 * run against a stub network (host names resolve to a public address, `localhost` to loopback) and the "image" is an 800 x 800 PNG.
 */
export async function checkImageUrl(url: string) {
  if (!devFixturesEnabled()) return fetchImageFromUrl(url);
  return fetchImageFromUrl(url, {
    lookup: async (host) => [host === 'localhost' ? '127.0.0.1' : '93.184.216.34'],
    fetch: (async () => new Response(syntheticPng(800, 800) as unknown as BodyInit, { status: 200 })) as typeof fetch,
  });
}

export const tailoringDeps: TailoringDeps = {
  probe: async (url) => {
    const checked = await checkImageUrl(url);
    return { width: checked.width, height: checked.height };
  },
};

const nonEmpty = (text: LocalizedText | undefined): LocalizedText => Object.fromEntries(Object.entries(text ?? {}).filter(([, v]) => v.trim()));

/** The localized string to store: every store language, the tailored text where given, else the master text. Undefined when nothing is tailored. */
function compose(tailored: LocalizedText | undefined, master: LocalizedText, languages: readonly string[]): LocalizedText | undefined {
  const given = nonEmpty(tailored);
  if (Object.keys(given).length === 0) return undefined;
  const out: LocalizedText = {};
  for (const l of languages) {
    const value = given[l] ?? master[l];
    if (value?.trim()) out[l] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

const differing = (tailored: LocalizedText | undefined, master: LocalizedText): string[] => Object.entries(nonEmpty(tailored)).filter(([l, v]) => v !== master[l]).map(([l]) => l);

const variantOf = (data: ProductTailoring['staged'] | undefined, variantId: number) => data?.variants?.find((v) => v.id === variantId) ?? data?.variants?.[0];

const toRefs = (images: Image[] | undefined): ImageRef[] => (images ?? []).map((i) => ({ url: i.url, ...(i.label ? { label: i.label } : {}), width: i.dimensions.w, height: i.dimensions.h }));

async function getTailoring(storeKey: string, productId: string): Promise<ProductTailoring | undefined> {
  const root = await catalogRoot();
  try {
    return (await root.inStoreKeyWithStoreKeyValue({ storeKey }).products().withProductId({ productID: productId }).productTailoring().get().execute()).body;
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

async function listStoreTailorings(storeKey: string): Promise<Map<string, ProductTailoring>> {
  const root = await catalogRoot();
  const { body } = await root.inStoreKeyWithStoreKeyValue({ storeKey }).productTailoring().get({ queryArgs: { limit: 500 } }).execute();
  return new Map(body.results.map((t) => [t.product.id, t]));
}

async function requireAssigned(storeKey: string, productId: string): Promise<ProductInfo> {
  const members = await loadMembers(storeKey);
  const row = members.rows.find((r) => r.info.id === productId && members.resellerIds.has(productId));
  if (!row) throw new CatalogError(400, 'NOT_IN_ASSORTMENT', 'The part is not in your assortment');
  return row.info;
}

/** Saves and publishes the tailoring in one request. All fields empty is the same as a reset. */
export async function saveTailoring(storeKey: string, productId: string, input: TailoringFields, by: string): Promise<{ published: true }> {
  void by; // the actor is the signed-in seller; commercetools records `lastModifiedBy` itself
  const store = await getSellerStore(storeKey);
  const used = [...Object.keys(input.name ?? {}), ...Object.keys(input.description ?? {})];
  const foreign = used.filter((l) => !store.languages.includes(l));
  if (foreign.length) throw new CatalogError(400, 'LANGUAGE_NOT_IN_STORE', 'Use only the languages of your store', { languages: [...new Set(foreign)] });
  const master = await requireAssigned(storeKey, productId);

  const name = compose(input.name, master.name, store.languages);
  const description = compose(input.description, master.description, store.languages);
  const existing = await getTailoring(storeKey, productId);

  const known = new Map<string, { width: number; height: number }>();
  for (const i of toRefs(variantOf(existing?.staged, master.variantId)?.images)) if (i.width && i.height) known.set(i.url, { width: i.width, height: i.height });
  const images: Image[] = [];
  for (const image of input.images ?? []) {
    const dims = known.get(image.url) ?? (await tailoringDeps.probe(image.url));
    images.push({ url: image.url, dimensions: { w: dims.width, h: dims.height }, ...(image.label ? { label: image.label } : {}) });
  }

  if (!name && !description && images.length === 0) {
    await resetTailoring(storeKey, productId);
    return { published: true };
  }

  const root = await catalogRoot();
  const target = root.inStoreKeyWithStoreKeyValue({ storeKey });
  if (!existing) {
    await target
      .productTailoring()
      .post({
        body: {
          product: { typeId: 'product', id: productId },
          ...(name ? { name } : {}),
          ...(description ? { description } : {}),
          ...(images.length ? { variants: [{ sku: master.sku, images }] } : {}),
          publish: true,
        },
      })
      .execute();
    return { published: true };
  }
  await retryOnConflict(async () => {
    const current = await getTailoring(storeKey, productId);
    if (!current) throw Object.assign(new Error('gone'), { statusCode: 409 });
    await target
      .products()
      .withProductId({ productID: productId })
      .productTailoring()
      .post({
        body: {
          version: current.version,
          actions: [
            { action: 'setName', name },
            { action: 'setDescription', description },
            { action: 'setImages', sku: master.sku, ...(images.length ? { images } : {}) },
            { action: 'publish' },
          ],
        },
      })
      .execute();
  });
  return { published: true };
}

/** Deletes the store's tailoring of the product: the master text and images show again. */
export async function resetTailoring(storeKey: string, productId: string): Promise<void> {
  // A withdrawn part can still be reset; the tailoring is looked up inside the store, so another store's is never reachable.
  const root = await catalogRoot();
  await retryOnConflict(async () => {
    const existing = await getTailoring(storeKey, productId);
    if (!existing) return;
    await root.inStoreKeyWithStoreKeyValue({ storeKey }).products().withProductId({ productID: productId }).productTailoring().delete({ queryArgs: { version: existing.version } }).execute();
  });
}

function summarize(info: ProductInfo, tailoring: ProductTailoring | undefined): Omit<TailoringRow, 'productId' | 'sku' | 'name'> {
  const data = tailoring?.staged;
  const locales = [...new Set([...differing(data?.name, info.name), ...differing(data?.description, info.description)])].sort();
  const images = variantOf(data, info.variantId)?.images ?? [];
  return { tailored: locales.length > 0 || images.length > 0, tailoredLocales: locales, hasTailoredImages: images.length > 0 };
}

/** The store's assigned parts with the tailored chip data, sorted by SKU. */
export async function listTailoring(storeKey: string, q: { offset: number; limit: number; text?: string }): Promise<{ rows: TailoringRow[]; total: number }> {
  const [assigned, tailorings] = await Promise.all([assignedBySku(storeKey), listStoreTailorings(storeKey)]);
  const needle = q.text?.trim().toLowerCase();
  const infos = [...assigned.values()].filter((i) => !needle || i.sku.toLowerCase().includes(needle) || Object.values(i.name).some((n) => n.toLowerCase().includes(needle)));
  const rows = infos.slice(q.offset, q.offset + q.limit).map((info) => ({ productId: info.id, sku: info.sku, name: info.name, ...summarize(info, tailorings.get(info.id)) }));
  return { rows, total: infos.length };
}

/** Master and tailored values side by side for the editor. */
export async function getTailoringDetail(storeKey: string, productId: string): Promise<TailoringDetail> {
  const store = await getSellerStore(storeKey);
  const fresh = await requireAssigned(storeKey, productId);
  const tailoring = await getTailoring(storeKey, productId);
  const data = tailoring?.staged;
  return {
    productId,
    sku: fresh.sku,
    languages: store.languages,
    master: { name: fresh.name, description: fresh.description, images: fresh.images },
    tailored: { name: nonEmpty(data?.name), description: nonEmpty(data?.description), images: toRefs(variantOf(data, fresh.variantId)?.images) },
    tailoredLocales: summarize(fresh, tailoring).tailoredLocales,
  };
}
