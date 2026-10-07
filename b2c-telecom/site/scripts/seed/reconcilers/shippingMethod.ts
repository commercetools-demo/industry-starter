import { COLLECTION, asReconciler, type Ctx, type Money, type ShippingMethodDraft, type ShippingRateDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.shippingMethod;

type ExistingRate = { price: Money; freeAbove?: Money };
type ExistingShipping = Versioned & {
  name: string;
  localizedName?: Record<string, string>;
  localizedDescription?: Record<string, string>;
  taxCategory: { id: string; obj?: Obj & { key?: string } };
  isDefault: boolean;
  active: boolean;
  predicate?: string;
  zoneRates: { zone: { id: string; obj?: Obj & { key?: string } }; shippingRates: ExistingRate[] }[];
};

const EXPAND = ['zoneRates[*].zone', 'taxCategory'];

function rateOf(r: ShippingRateDraft | ExistingRate): ExistingRate {
  return { price: { currencyCode: r.price.currencyCode, centAmount: r.price.centAmount }, ...(r.freeAbove ? { freeAbove: r.freeAbove } : {}) };
}

function sameRate(a: ExistingRate, b: ExistingRate): boolean {
  return a.price.centAmount === b.price.centAmount && a.freeAbove?.centAmount === b.freeAbove?.centAmount;
}

export function planShipping(existing: ExistingShipping, draft: ShippingMethodDraft, ctx?: Ctx): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (field(changes, 'localizedName', existing.localizedName, draft.localizedName)) actions.push({ action: 'setLocalizedName', localizedName: draft.localizedName });
  if (field(changes, 'localizedDescription', existing.localizedDescription, draft.localizedDescription)) {
    actions.push({ action: 'setLocalizedDescription', localizedDescription: draft.localizedDescription });
  }
  if (field(changes, 'taxCategory', existing.taxCategory.obj?.key, draft.taxCategory.key)) {
    actions.push({ action: 'changeTaxCategory', taxCategory: { typeId: 'tax-category', key: draft.taxCategory.key } });
  }
  if (field(changes, 'isDefault', existing.isDefault, draft.isDefault)) actions.push({ action: 'changeIsDefault', isDefault: draft.isDefault });
  if (field(changes, 'active', existing.active, draft.active)) actions.push({ action: 'changeActive', active: draft.active });
  if (field(changes, 'predicate', existing.predicate, draft.predicate)) actions.push({ action: 'setPredicate', predicate: draft.predicate });

  const wantedZoneKeys: string[] = [];
  for (const wanted of draft.zoneRates) {
    const zoneKey = ctx?.zoneKeys[wanted.zone];
    if (!zoneKey) return { changes, actions, conflict: `no zone adopted for country ${wanted.zone}` };
    wantedZoneKeys.push(zoneKey);
    const zone = { typeId: 'zone', key: zoneKey };
    const current = existing.zoneRates.find((z) => z.zone.obj?.key === zoneKey);
    if (!current) {
      changes.push({ path: `zoneRates.${zoneKey}`, from: undefined, to: wanted.shippingRates.map(rateOf) });
      actions.push({ action: 'addZone', zone });
    }
    const have = current?.shippingRates ?? [];
    for (const want of wanted.shippingRates.map(rateOf)) {
      const found = have.find((h) => h.price.currencyCode === want.price.currencyCode);
      if (found && sameRate(found, want)) continue;
      if (found) {
        changes.push({ path: `zoneRates.${zoneKey}.${want.price.currencyCode}`, from: found.price.centAmount, to: want.price.centAmount });
        actions.push({ action: 'removeShippingRate', zone, shippingRate: rateOf(found) });
      } else if (current) {
        changes.push({ path: `zoneRates.${zoneKey}.${want.price.currencyCode}`, from: undefined, to: want.price.centAmount });
      }
      actions.push({ action: 'addShippingRate', zone, shippingRate: want });
    }
    for (const h of have) {
      if (!wanted.shippingRates.some((w) => w.price.currencyCode === h.price.currencyCode)) {
        changes.push({ path: `zoneRates.${zoneKey}.${h.price.currencyCode}`, from: h.price.centAmount, to: undefined });
        actions.push({ action: 'removeShippingRate', zone, shippingRate: rateOf(h) });
      }
    }
  }
  for (const z of existing.zoneRates) {
    const key = z.zone.obj?.key;
    if (key && !wantedZoneKeys.includes(key)) {
      changes.push({ path: `zoneRates.${key}`, from: 'present', to: undefined });
      actions.push({ action: 'removeZone', zone: { typeId: 'zone', key } });
    }
  }
  return { changes, actions };
}

export const shippingMethodReconciler = asReconciler<ShippingMethodDraft, ExistingShipping>({
  kind: 'shippingMethod',
  order: 70,
  refs: (d) => [
    { kind: 'taxCategory', key: d.taxCategory.key, from: { kind: 'shippingMethod', key: d.key } },
    ...d.zoneRates.map((z) => ({ kind: 'zoneCoverage' as const, key: z.zone, from: { kind: 'shippingMethod' as const, key: d.key } })),
  ],
  fetch: (api, key) => getByKey<ExistingShipping>(api, COLL, key, { expand: EXPAND }),
  create: async (api, draft, ctx) => {
    const zoneRates = draft.zoneRates.map((z) => {
      const key = ctx.zoneKeys[z.zone];
      if (!key) throw new Error(`no zone adopted for country ${z.zone}`);
      return { zone: { typeId: 'zone', key }, shippingRates: z.shippingRates.map(rateOf) };
    });
    await api.post(COLL, {
      key: draft.key,
      name: draft.name,
      localizedName: draft.localizedName,
      localizedDescription: draft.localizedDescription,
      taxCategory: { typeId: 'tax-category', key: draft.taxCategory.key },
      isDefault: draft.isDefault,
      active: draft.active,
      ...(draft.predicate ? { predicate: draft.predicate } : {}),
      zoneRates,
    });
  },
  diff: (existing, draft, ctx) => {
    const { changes, conflict } = planShipping(existing, draft, ctx);
    return { changes, ...(conflict ? { conflict } : {}) };
  },
  update: async (api, existing, _changes, draft, ctx) => postUpdate(api, COLL, existing, planShipping(existing, draft, ctx).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
