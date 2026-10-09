import { CATEGORIES, categoryDrafts } from './data/categories';
import { DOCTORS, doctorDraft, doctorKey } from './data/doctors';
import { MEDICATIONS, medicationDraft, medicationInventory, medKey, medSku } from './data/medications';
import { SAME_DAY_ZONE, SHIPPING_METHODS } from './data/shipping';
import { STATES, stateDraft, transitionRefs } from './data/states';
import { TAX_CATEGORIES } from './data/tax';
import { CHANNELS, CUSTOM_TYPES, PRODUCT_TYPES } from './data/types';
import {
  applyActions, ensurePlanned, inventoryDraft, listAll,
  type Ctx, type EnsureResult, type Step,
} from './lib';
import { categoryPlan, channelPlan, customTypePlan, inventoryPlan, productPlan, productTypePlan, shippingPlan, statePlan, taxPlan, zonePlan } from './update-plans';

/** Seed steps in dependency order. Each step is create-if-missing and reports a difference instead of overwriting. */

/** Existing resources are updated to match the seed where commercetools allows it (update-plans.ts); otherwise the run stops with the reset that is needed. */

export function channelSteps(ctx: Ctx): Step[] {
  return CHANNELS.map((c) => ({ name: `channel ${c.key}`, run: () => ensurePlanned(ctx, 'channels', c, channelPlan) }));
}

export function taxSteps(ctx: Ctx): Step[] {
  return TAX_CATEGORIES.map((t) => ({ name: `tax category ${t.key}`, run: () => ensurePlanned(ctx, 'taxCategories', t, taxPlan) }));
}

/** Creates the states, then sets each one's transitions (state keys cannot be referenced before they exist). */
export function stateSteps(ctx: Ctx): Step[] {
  const create = STATES.map((s) => ({ name: `state ${s.key}`, run: () => ensurePlanned(ctx, 'states', stateDraft(s), statePlan) }));
  const transitions = STATES.filter((s) => s.transitions.length > 0).map((s) => ({
    name: `state transitions ${s.key}`,
    run: async (): Promise<EnsureResult> => {
      const all = await listAll(ctx.root, 'states');
      const idToKey = new Map(all.map((r) => [r.id as string, r.key as string]));
      const current = all.find((r) => r.key === s.key);
      if (!current) return ctx.dryRun ? 'would-update' : { diff: `state ${s.key} missing` };
      const have = ((current.transitions as { id?: string; key?: string }[]) ?? []).map((t) => t.key ?? idToKey.get(t.id ?? '') ?? '?').sort();
      if (JSON.stringify(have) === JSON.stringify([...s.transitions].sort())) return 'ok';
      if (ctx.dryRun) return 'would-update';
      await applyActions(ctx, 'states', s.key, [{ action: 'setTransitions', transitions: transitionRefs(s) }]);
      return 'updated';
    },
  }));
  return [...create, ...transitions];
}

export function typeSteps(ctx: Ctx): Step[] {
  return [
    ...CUSTOM_TYPES.map((t) => ({ name: `type ${t.key}`, run: () => ensurePlanned(ctx, 'types', t, customTypePlan) })),
    ...PRODUCT_TYPES.map((t) => ({ name: `product type ${t.key}`, run: () => ensurePlanned(ctx, 'productTypes', t, productTypePlan) })),
  ];
}

export function categorySteps(ctx: Ctx): Step[] {
  const drafts = categoryDrafts();
  return drafts.map((d, i) => ({ name: `category ${CATEGORIES[i].key}`, run: () => ensurePlanned(ctx, 'categories', d, categoryPlan) }));
}

/** Zone first, then methods (a method references its zone and tax category by key). */
export function shippingSteps(ctx: Ctx): Step[] {
  return [
    { name: `zone ${SAME_DAY_ZONE.key}`, run: () => ensurePlanned(ctx, 'zones', SAME_DAY_ZONE, zonePlan) },
    ...SHIPPING_METHODS.map((m) => ({ name: `shipping method ${m.key}`, run: () => ensurePlanned(ctx, 'shippingMethods', m, shippingPlan) })),
  ];
}

export interface ProductOptions { only?: string }

export function doctorSteps(ctx: Ctx, o: ProductOptions = {}): Step[] {
  return DOCTORS.filter((d) => !o.only || doctorKey(d) === o.only).map((d) => ({
    name: `product ${doctorKey(d)}`,
    run: () => ensurePlanned(ctx, 'products', doctorDraft(d), productPlan),
  }));
}

/** Medication products, then one inventory entry per SKU with the native cart limit (and the expiry field on the demo SKU). */
export function medicationSteps(ctx: Ctx, o: ProductOptions = {}): Step[] {
  const meds = MEDICATIONS.filter((d) => !o.only || medKey(d) === o.only);
  return [
    ...meds.map((d) => ({
      name: `product ${medKey(d)}`,
      run: () => ensurePlanned(ctx, 'products', medicationDraft(d), productPlan),
    })),
    ...meds.map((d) => ({
      name: `inventory ${medSku(d)}`,
      run: () => ensurePlanned(ctx, 'inventory', inventoryDraft(medicationInventory(d)), inventoryPlan),
    })),
  ];
}

export const foundationSteps = (ctx: Ctx): Step[] => [...channelSteps(ctx), ...taxSteps(ctx), ...stateSteps(ctx), ...typeSteps(ctx), ...categorySteps(ctx), ...shippingSteps(ctx)];
