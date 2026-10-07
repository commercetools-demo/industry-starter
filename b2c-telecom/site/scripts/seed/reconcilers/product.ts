import type { CtApi } from '../lib';
import { COLLECTION, asReconciler, type PriceDraft, type ProductDraft, type VariantDraft } from '../types';
import { covers, field, getByKey, idOfKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.product;

type Ref = { id: string; obj?: Obj & { key?: string } };
type ExistingVariant = {
  id: number;
  sku: string;
  attributes?: { name: string; value: unknown }[];
  prices?: (Obj & { key?: string; value: { centAmount: number; currencyCode: string }; country?: string; customerGroup?: Ref; validFrom?: string; validUntil?: string })[];
  images?: { url: string }[];
};
type ExistingProduct = Versioned & {
  productType: Ref;
  taxCategory?: Ref;
  masterData: {
    published: boolean;
    hasStagedChanges: boolean;
    staged: {
      name: Record<string, string>;
      slug: Record<string, string>;
      description?: Record<string, string>;
      categories: Ref[];
      categoryOrderHints?: Record<string, string>;
      masterVariant: ExistingVariant;
      variants: ExistingVariant[];
    };
  };
};

const EXPAND = [
  'productType',
  'taxCategory',
  'masterData.staged.categories[*]',
  'masterData.staged.masterVariant.prices[*].customerGroup',
  'masterData.staged.variants[*].prices[*].customerGroup',
];

/** Enum values come back as { key, label }; the draft carries the key. */
function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value !== null && typeof value === 'object' && 'key' in value && 'label' in value) return (value as { key: unknown }).key;
  return value;
}

function priceDraft(p: PriceDraft): Obj {
  return {
    key: p.key,
    value: p.value,
    ...(p.country ? { country: p.country } : {}),
    ...(p.customerGroup ? { customerGroup: { typeId: 'customer-group', key: p.customerGroup } } : {}),
    ...(p.validFrom ? { validFrom: p.validFrom } : {}),
    ...(p.validUntil ? { validUntil: p.validUntil } : {}),
  };
}

function pricesDiffer(existing: ExistingVariant, wanted: VariantDraft): boolean {
  const have = existing.prices ?? [];
  if (have.length !== wanted.prices.length) return true;
  return wanted.prices.some((w) => {
    const h = have.find((x) => x.key === w.key);
    if (!h) return true;
    return !covers(h.value, w.value) || h.country !== w.country || (h.customerGroup?.obj?.key ?? undefined) !== w.customerGroup || h.validFrom !== w.validFrom || h.validUntil !== w.validUntil;
  });
}

function variantDraftBody(v: VariantDraft): Obj {
  return {
    sku: v.sku,
    ...(v.key ? { key: v.key } : {}),
    attributes: v.attributes,
    prices: v.prices.map(priceDraft),
    images: v.images ?? [],
  };
}

export function planProduct(existing: ExistingProduct, draft: ProductDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  const staged = existing.masterData.staged;
  const typeKey = existing.productType.obj?.key;
  if (typeKey !== draft.productType) {
    return { changes, actions, conflict: `productType differs (existing "${typeKey}", manifest "${draft.productType}"); a product type cannot be changed on a product` };
  }
  if (field(changes, 'name', staged.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (field(changes, 'slug', staged.slug, draft.slug)) actions.push({ action: 'changeSlug', slug: draft.slug });
  if (field(changes, 'description', staged.description, draft.description)) actions.push({ action: 'setDescription', description: draft.description });
  if (field(changes, 'taxCategory', existing.taxCategory?.obj?.key, draft.taxCategory)) {
    actions.push({ action: 'setTaxCategory', taxCategory: { typeId: 'tax-category', key: draft.taxCategory } });
  }

  // categories and their order hints (hints are keyed by category id on the platform)
  const have = staged.categories.map((c) => ({ id: c.id, key: c.obj?.key }));
  const hints = draft.categoryOrderHints ?? {};
  for (const key of draft.categories) {
    const current = have.find((h) => h.key === key);
    if (!current) {
      changes.push({ path: `categories.${key}`, from: undefined, to: 'added' });
      actions.push({ action: 'addToCategory', category: { typeId: 'category', key }, ...(hints[key] ? { orderHint: hints[key] } : {}) });
    } else if (draft.categoryOrderHints !== undefined) {
      const currentHint = staged.categoryOrderHints?.[current.id];
      if (currentHint !== hints[key]) {
        changes.push({ path: `categoryOrderHints.${key}`, from: currentHint, to: hints[key] });
        actions.push({ action: 'setCategoryOrderHint', categoryId: current.id, ...(hints[key] ? { orderHint: hints[key] } : {}) });
      }
    }
  }
  for (const current of have) {
    if (current.key && !draft.categories.includes(current.key)) {
      changes.push({ path: `categories.${current.key}`, from: 'present', to: undefined });
      actions.push({ action: 'removeFromCategory', category: { typeId: 'category', id: current.id } });
    }
  }

  // variants by SKU
  const existingVariants = [staged.masterVariant, ...staged.variants];
  if (staged.masterVariant.sku !== draft.masterVariant.sku) {
    return { changes, actions, conflict: `master variant SKU differs (existing "${staged.masterVariant.sku}", manifest "${draft.masterVariant.sku}")` };
  }
  const wantedVariants = [draft.masterVariant, ...draft.variants];
  for (const wanted of wantedVariants) {
    const current = existingVariants.find((v) => v.sku === wanted.sku);
    if (!current) {
      changes.push({ path: `variants.${wanted.sku}`, from: undefined, to: 'added' });
      actions.push({ action: 'addVariant', ...variantDraftBody(wanted) });
      continue;
    }
    for (const attribute of wanted.attributes) {
      const currentAttr = (current.attributes ?? []).find((a) => a.name === attribute.name);
      if (!currentAttr || !covers(normalizeValue(currentAttr.value), attribute.value)) {
        changes.push({ path: `variants.${wanted.sku}.attributes.${attribute.name}`, from: currentAttr ? normalizeValue(currentAttr.value) : undefined, to: attribute.value });
        actions.push({ action: 'setAttribute', sku: wanted.sku, name: attribute.name, value: attribute.value });
      }
    }
    for (const currentAttr of current.attributes ?? []) {
      if (!wanted.attributes.some((a) => a.name === currentAttr.name)) {
        changes.push({ path: `variants.${wanted.sku}.attributes.${currentAttr.name}`, from: normalizeValue(currentAttr.value), to: undefined });
        actions.push({ action: 'setAttribute', sku: wanted.sku, name: currentAttr.name });
      }
    }
    if (pricesDiffer(current, wanted)) {
      changes.push({ path: `variants.${wanted.sku}.prices`, from: (current.prices ?? []).map((p) => p.value), to: wanted.prices.map((p) => p.value) });
      actions.push({ action: 'setPrices', sku: wanted.sku, prices: wanted.prices.map(priceDraft) });
    }
    if (wanted.images) {
      const haveUrls = (current.images ?? []).map((i) => i.url);
      for (const image of wanted.images) {
        if (!haveUrls.includes(image.url)) {
          changes.push({ path: `variants.${wanted.sku}.images`, from: undefined, to: image.url });
          actions.push({ action: 'addExternalImage', sku: wanted.sku, image });
        }
      }
      for (const url of haveUrls) {
        if (!wanted.images.some((i) => i.url === url)) {
          changes.push({ path: `variants.${wanted.sku}.images`, from: url, to: undefined });
          actions.push({ action: 'removeImage', sku: wanted.sku, imageUrl: url });
        }
      }
    }
  }
  for (const current of staged.variants) {
    if (!wantedVariants.some((w) => w.sku === current.sku)) {
      changes.push({ path: `variants.${current.sku}`, from: 'present', to: undefined });
      actions.push({ action: 'removeVariant', sku: current.sku });
    }
  }

  // published state
  if (draft.publish) {
    if (changes.length > 0 || !existing.masterData.published || existing.masterData.hasStagedChanges) {
      if (changes.length === 0) changes.push({ path: 'published', from: existing.masterData.published ? 'staged changes' : false, to: true });
      actions.push({ action: 'publish' });
    }
  } else if (existing.masterData.published) {
    changes.push({ path: 'published', from: true, to: false });
    actions.push({ action: 'unpublish' });
  }
  return { changes, actions };
}

async function categoryHints(api: CtApi, draft: ProductDraft): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, hint] of Object.entries(draft.categoryOrderHints ?? {})) {
    const id = await idOfKey(api, COLLECTION.category, key);
    if (!id) throw new Error(`category "${key}" not found for order hint`);
    out[id] = hint;
  }
  return out;
}

export async function unpublishAndDelete(api: CtApi, existing: Versioned): Promise<void> {
  const res = (await api.post(`${COLL}/key=${existing.key}`, { version: existing.version, actions: [{ action: 'unpublish' }] })) as { version: number };
  await api.del(`${COLL}/key=${existing.key}`, { version: res.version });
}

export const productReconciler = asReconciler<ProductDraft, ExistingProduct>({
  kind: 'product',
  order: 80,
  refs: (d) => [
    { kind: 'productType', key: d.productType, from: { kind: 'product', key: d.key } },
    { kind: 'taxCategory', key: d.taxCategory, from: { kind: 'product', key: d.key } },
    ...d.categories.map((key) => ({ kind: 'category' as const, key, from: { kind: 'product' as const, key: d.key } })),
    ...[d.masterVariant, ...d.variants].flatMap((v) =>
      v.prices.flatMap((p) => (p.customerGroup ? [{ kind: 'customerGroup' as const, key: p.customerGroup, from: { kind: 'product' as const, key: d.key } }] : [])),
    ),
  ],
  fetch: (api, key) => getByKey<ExistingProduct>(api, COLL, key, { expand: EXPAND }),
  create: async (api, draft) => {
    const hints = await categoryHints(api, draft);
    await api.post(COLL, {
      key: draft.key,
      productType: { typeId: 'product-type', key: draft.productType },
      name: draft.name,
      slug: draft.slug,
      ...(draft.description ? { description: draft.description } : {}),
      categories: draft.categories.map((key) => ({ typeId: 'category', key })),
      ...(Object.keys(hints).length ? { categoryOrderHints: hints } : {}),
      taxCategory: { typeId: 'tax-category', key: draft.taxCategory },
      masterVariant: variantDraftBody(draft.masterVariant),
      variants: draft.variants.map(variantDraftBody),
      publish: draft.publish,
    });
  },
  diff: (existing, draft) => {
    const { changes, conflict } = planProduct(existing, draft);
    return { changes, ...(conflict ? { conflict } : {}) };
  },
  update: async (api, existing, _changes, draft) => {
    const { actions } = planProduct(existing, draft);
    if (actions.length > 0) await api.post(`${COLL}/key=${existing.key}`, { version: existing.version, actions });
  },
  remove: (api, existing) => unpublishAndDelete(api, existing),
});
