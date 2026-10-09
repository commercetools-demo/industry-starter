import { listAll, type Ctx, type Rec } from './lib';

/**
 * Update plans (D-038, follow-up AC): given an EXISTING resource and the seed DRAFT, return the update actions that make the
 * resource equal the draft, or a `blocked` message when commercetools cannot make that change in place. The message names the
 * reset that is needed, so a changed seed never just "stops on a diff" when an update is possible.
 */
export interface UpdatePlan { actions: Rec[]; blocked?: string }

/** Appended to every blocked message. `seed:full` is the whole rebuild; `seed:reset` + `seed` is the manual form. */
export const RESET_HINT =
  'Reset is needed: run `npm run seed:full` (full rebuild, deletes seeded customers too) or `npm run seed:reset -- --confirm spec-test-b2c-healthcare --include-customers` and then `npm run seed`.';

const json = (v: unknown) => JSON.stringify(v ?? null);
const blocked = (what: string): UpdatePlan => ({ actions: [], blocked: `${what}. ${RESET_HINT}` });
const asList = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------- product types

type AttrType = { name?: string; values?: { key: string }[]; elementType?: AttrType };
const enumValuesOf = (t: AttrType | undefined): { key: string }[] | undefined => (t?.name === 'set' ? enumValuesOf(t.elementType) : t?.values);
const typeSignature = (t: AttrType | undefined): string => (t?.name === 'set' ? `set<${typeSignature(t.elementType)}>` : (t?.name ?? '?'));

/**
 * New attributes, new enum values, labels, `isSearchable` (`changeIsSearchable`) and a relaxed constraint are updated in place.
 * A changed attribute type, a changed `isRequired`, a tightened constraint and a removed attribute are not: `blocked`.
 */
export function productTypePlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  const have = new Map(asList(existing.attributes).map((a) => [str(a.name), a]));
  for (const want of asList(draft.attributes)) {
    const name = str(want.name);
    const cur = have.get(name);
    if (!cur) {
      actions.push({ action: 'addAttributeDefinition', attribute: want });
      continue;
    }
    if (typeSignature(cur.type as AttrType) !== typeSignature(want.type as AttrType)) {
      return blocked(`product type ${str(draft.key)}: attribute "${name}" changed type (${typeSignature(cur.type as AttrType)} to ${typeSignature(want.type as AttrType)}); an attribute type cannot be changed`);
    }
    if (Boolean(cur.isRequired) !== Boolean(want.isRequired)) {
      return blocked(`product type ${str(draft.key)}: attribute "${name}" changed isRequired (${String(cur.isRequired)} to ${String(want.isRequired)}); it cannot be changed`);
    }
    if (str(cur.attributeConstraint) !== str(want.attributeConstraint)) {
      if (str(want.attributeConstraint) === 'None') actions.push({ action: 'changeAttributeConstraint', attributeName: name, newValue: 'None' });
      else return blocked(`product type ${str(draft.key)}: attribute "${name}" constraint ${str(cur.attributeConstraint)} to ${str(want.attributeConstraint)}; a constraint can only be relaxed to None`);
    }
    if (Boolean(cur.isSearchable) !== Boolean(want.isSearchable)) {
      actions.push({ action: 'changeIsSearchable', attributeName: name, isSearchable: Boolean(want.isSearchable) });
    }
    if (json(cur.label) !== json(want.label)) actions.push({ action: 'changeLabel', attributeName: name, label: want.label });
    const haveEnum = new Set((enumValuesOf(cur.type as AttrType) ?? []).map((v) => v.key));
    const wantEnum = (want.type as AttrType | undefined) && enumValuesOf(want.type as AttrType);
    for (const v of wantEnum ?? []) {
      if (!haveEnum.has(v.key)) actions.push({ action: 'addPlainEnumValue', attributeName: name, value: v });
    }
  }
  const wanted = new Set(asList(draft.attributes).map((a) => str(a.name)));
  const removed = [...have.keys()].filter((n) => !wanted.has(n));
  if (removed.length > 0) return blocked(`product type ${str(draft.key)}: attribute(s) ${removed.join(', ')} are no longer in the seed; removing them would delete their values on every product`);
  return { actions };
}

// ---------------------------------------------------------------- custom types

/** New fields and changed labels are updated in place; a changed field type, a removed field or other resource types are not. */
export function customTypePlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  const have = new Map(asList(existing.fieldDefinitions).map((f) => [str(f.name), f]));
  for (const want of asList(draft.fieldDefinitions)) {
    const cur = have.get(str(want.name));
    if (!cur) actions.push({ action: 'addFieldDefinition', fieldDefinition: want });
    else {
      if (json(cur.type) !== json(want.type)) return blocked(`type ${str(draft.key)}: field "${str(want.name)}" changed type; a field type cannot be changed`);
      if (json(cur.label) !== json(want.label)) actions.push({ action: 'changeLabel', fieldName: str(want.name), label: want.label });
    }
  }
  const wanted = new Set(asList(draft.fieldDefinitions).map((f) => str(f.name)));
  const removed = [...have.keys()].filter((n) => !wanted.has(n));
  if (removed.length > 0) return blocked(`type ${str(draft.key)}: field(s) ${removed.join(', ')} are no longer in the seed (removing a field deletes its values)`);
  const ids = (r: Rec) => json([...(Array.isArray(r.resourceTypeIds) ? (r.resourceTypeIds as string[]) : [])].sort());
  if (ids(existing) !== ids(draft)) return blocked(`type ${str(draft.key)}: resourceTypeIds differ; they cannot be changed`);
  return { actions };
}

// ---------------------------------------------------------------- products

const channelKeys = new WeakMap<Ctx, Promise<Map<string, string>>>();
async function channelKeyById(ctx: Ctx): Promise<Map<string, string>> {
  let p = channelKeys.get(ctx);
  if (!p) {
    p = listAll(ctx.root, 'channels').then((all) => new Map(all.map((c) => [str(c.id), str(c.key)])));
    channelKeys.set(ctx, p);
  }
  return p;
}

type PriceRec = { id?: string; value: { currencyCode: string; centAmount: number }; channel?: { key?: string; id?: string }; country?: string; customerGroup?: { key?: string; id?: string } };
type VariantRec = { sku?: string; prices?: PriceRec[]; attributes?: { name: string; value: unknown }[] };

const stagedMaster = (e: Rec): VariantRec => ((e.masterData as { staged?: { masterVariant?: VariantRec } } | undefined)?.staged?.masterVariant ?? {});

/** Enum values come back as `{key,label}`; the draft carries the key. */
const normAttr = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(normAttr);
  if (v && typeof v === 'object' && 'key' in v && 'label' in v) return (v as { key: string }).key;
  return v;
};

/**
 * Prices (add, change, remove by channel + currency + country), attributes (`setAttribute`) and name, slug and description are updated in place on the
 * staged master variant; the product is then published again when the draft says `publish`. Images are owned by update-images.ts.
 */
export async function productPlan(existing: Rec, draft: Rec, ctx: Ctx): Promise<UpdatePlan> {
  const want = draft.masterVariant as VariantRec;
  const have = stagedMaster(existing);
  if (have.sku !== want.sku) return blocked(`product ${str(draft.key)}: sku is ${String(have.sku)} but the seed says ${String(want.sku)}; a SKU is not rewritten`);
  const actions: Rec[] = [];
  const staged = (existing.masterData as { staged?: Rec; published?: boolean; hasStagedChanges?: boolean } | undefined)?.staged ?? {};
  if (json(staged.name) !== json(draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (json(staged.slug) !== json(draft.slug)) actions.push({ action: 'changeSlug', slug: draft.slug });
  if (json(staged.description) !== json(draft.description)) actions.push({ action: 'setDescription', description: draft.description });

  const idToKey = await channelKeyById(ctx);
  const pk = (p: PriceRec) => `${p.channel?.key ?? idToKey.get(p.channel?.id ?? '') ?? ''}|${p.value.currencyCode}|${p.country ?? ''}|${p.customerGroup?.key ?? p.customerGroup?.id ?? ''}`;
  const current = new Map((have.prices ?? []).map((p) => [pk(p), p]));
  const wantedKeys = new Set<string>();
  for (const price of want.prices ?? []) {
    const k = pk(price);
    wantedKeys.add(k);
    const cur = current.get(k);
    if (!cur) actions.push({ action: 'addPrice', sku: want.sku, price });
    else if (cur.value.centAmount !== price.value.centAmount) actions.push({ action: 'changePrice', priceId: cur.id, price });
  }
  for (const [k, cur] of current) if (!wantedKeys.has(k)) actions.push({ action: 'removePrice', priceId: cur.id });

  const attrs = new Map((have.attributes ?? []).map((a) => [a.name, a.value]));
  for (const a of want.attributes ?? []) {
    if (!attrs.has(a.name) || json(normAttr(attrs.get(a.name))) !== json(a.value)) actions.push({ action: 'setAttribute', sku: want.sku, name: a.name, value: a.value });
  }

  const md = existing.masterData as { published?: boolean; hasStagedChanges?: boolean } | undefined;
  if (draft.publish && (actions.length > 0 || !md?.published || md.hasStagedChanges)) {
    // a publish with nothing to publish is rejected as a no-op by the platform; only add it when something changed or it is unpublished
    actions.push({ action: 'publish' });
  }
  return { actions: actions.length === 1 && actions[0].action === 'publish' && md?.published && !md.hasStagedChanges ? [] : actions };
}

// ---------------------------------------------------------------- inventory

/** Only the cart limit and the expiry field are compared; existing stock is never reset. */
export function inventoryPlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  if ((existing.maxCartQuantity ?? null) !== (draft.maxCartQuantity ?? null)) {
    actions.push({ action: 'setInventoryLimits', ...(draft.maxCartQuantity !== undefined ? { maxCartQuantity: draft.maxCartQuantity } : {}), ...(existing.minCartQuantity !== undefined ? { minCartQuantity: existing.minCartQuantity } : {}) });
  }
  const expiry = (r: Rec) => ((r.custom as { fields?: Rec } | undefined)?.fields?.expiryDate ?? null);
  if (expiry(existing) !== expiry(draft)) {
    const custom = draft.custom as { type: unknown; fields: Rec } | undefined;
    if (custom && !existing.custom) actions.push({ action: 'setCustomType', type: custom.type, fields: custom.fields });
    else actions.push({ action: 'setCustomField', name: 'expiryDate', value: expiry(draft) ?? null });
  }
  return { actions };
}

// ---------------------------------------------------------------- shipping, tax, zones, channels, categories, states

type Rate = { price: { centAmount: number; currencyCode: string }; freeAbove?: { centAmount: number; currencyCode: string } };
type ZoneRate = { zone: { id?: string; key?: string }; shippingRates: Rate[] };

/** Rates per zone are added (new) then removed (old); `isDefault` is changed in place. A zone is matched by key or by id. */
export async function shippingPlan(existing: Rec, draft: Rec, ctx: Ctx): Promise<UpdatePlan> {
  const actions: Rec[] = [];
  if (existing.isDefault !== draft.isDefault) actions.push({ action: 'changeIsDefault', isDefault: draft.isDefault });
  const zones = await listAll(ctx.root, 'zones');
  const idOf = (z: { id?: string; key?: string }) => z.id ?? str(zones.find((x) => x.key === z.key)?.id);
  const ratesJson = (r: Rate) => json([r.price.centAmount, r.price.currencyCode, r.freeAbove?.centAmount ?? null]);
  const haveZones = (existing.zoneRates as ZoneRate[] | undefined) ?? [];
  for (const wantZone of (draft.zoneRates as ZoneRate[] | undefined) ?? []) {
    const zoneId = idOf(wantZone.zone);
    const cur = haveZones.find((z) => idOf(z.zone) === zoneId);
    if (!cur) {
      actions.push({ action: 'addZone', zone: { typeId: 'zone', id: zoneId } });
      for (const rate of wantZone.shippingRates) actions.push({ action: 'addShippingRate', zone: { typeId: 'zone', id: zoneId }, shippingRate: rate });
      continue;
    }
    const haveSet = new Set(cur.shippingRates.map(ratesJson));
    const wantSet = new Set(wantZone.shippingRates.map(ratesJson));
    for (const rate of wantZone.shippingRates) if (!haveSet.has(ratesJson(rate))) actions.push({ action: 'addShippingRate', zone: { typeId: 'zone', id: zoneId }, shippingRate: rate });
    for (const rate of cur.shippingRates) {
      if (!wantSet.has(ratesJson(rate))) {
        actions.push({ action: 'removeShippingRate', zone: { typeId: 'zone', id: zoneId }, shippingRate: { price: rate.price, ...(rate.freeAbove ? { freeAbove: rate.freeAbove } : {}) } });
      }
    }
  }
  return { actions };
}

type TaxRate = { id?: string; name?: string; amount: number; country: string; state?: string; includedInPrice?: boolean };

export function taxPlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  const have = (existing.rates as TaxRate[] | undefined) ?? [];
  const keyOf = (r: TaxRate) => `${r.country}|${r.state ?? ''}`;
  const wanted = (draft.rates as TaxRate[] | undefined) ?? [];
  for (const w of wanted) {
    const cur = have.find((r) => keyOf(r) === keyOf(w));
    if (!cur) actions.push({ action: 'addTaxRate', taxRate: w });
    else if (cur.amount !== w.amount || Boolean(cur.includedInPrice) !== Boolean(w.includedInPrice)) actions.push({ action: 'replaceTaxRate', taxRateId: cur.id, taxRate: w });
  }
  for (const cur of have) if (!wanted.some((w) => keyOf(w) === keyOf(cur))) actions.push({ action: 'removeTaxRate', taxRateId: cur.id });
  return { actions };
}

export function zonePlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  const loc = (l: { country: string; state?: string }) => `${l.country}|${l.state ?? ''}`;
  const have = (existing.locations as { country: string; state?: string }[] | undefined) ?? [];
  const wanted = (draft.locations as { country: string; state?: string }[] | undefined) ?? [];
  for (const w of wanted) if (!have.some((h) => loc(h) === loc(w))) actions.push({ action: 'addLocation', location: w });
  for (const h of have) if (!wanted.some((w) => loc(w) === loc(h))) actions.push({ action: 'removeLocation', location: h });
  return { actions };
}

export function channelPlan(existing: Rec, draft: Rec): UpdatePlan {
  const norm = (r: Rec) => json([...(Array.isArray(r.roles) ? (r.roles as string[]) : [])].sort());
  return norm(existing) === norm(draft) ? { actions: [] } : { actions: [{ action: 'setRoles', roles: draft.roles }] };
}

export function categoryPlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  if (json(existing.name) !== json(draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (json(existing.slug) !== json(draft.slug)) actions.push({ action: 'changeSlug', slug: draft.slug });
  if (!!existing.parent !== !!draft.parent) return blocked(`category ${str(draft.key)}: parent differs (a category is not re-parented by the seed)`);
  return { actions };
}

export function statePlan(existing: Rec, draft: Rec): UpdatePlan {
  const actions: Rec[] = [];
  if (existing.type !== draft.type) actions.push({ action: 'changeType', type: draft.type });
  if (Boolean(existing.initial) !== Boolean(draft.initial)) actions.push({ action: 'changeInitial', initial: Boolean(draft.initial) });
  return { actions };
}
