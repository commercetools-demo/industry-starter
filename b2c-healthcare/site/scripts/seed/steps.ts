import { CATEGORIES, categoryDrafts } from './data/categories';
import { STATES, stateDraft, transitionRefs } from './data/states';
import { TAX_CATEGORIES } from './data/tax';
import { CHANNELS, CUSTOM_TYPES, PRODUCT_TYPES } from './data/types';
import {
  applyActions, diffProductType, diffTax, diffType, ensureKeyed, listAll, pickDiff,
  type Ctx, type EnsureResult, type Rec, type Step,
} from './lib';

/** Seed steps in dependency order. Each step is create-if-missing and reports a difference instead of overwriting. */

const diffChannel = (e: Rec, d: Rec) => {
  const norm = (r: Rec) => JSON.stringify([...((r.roles as string[]) ?? [])].sort());
  return norm(e) === norm(d) ? null : 'roles differ';
};

const diffCategory = (e: Rec, d: Rec) => {
  const base = pickDiff(e, d, ['name', 'slug']);
  if (base) return base;
  const parent = (r: Rec) => (r.parent as { key?: string } | undefined)?.key ?? null;
  // an existing category holds only the parent id; compare presence of a parent, the key check is made through the tree test
  return !!(e.parent as unknown) === !!parent(d) ? null : 'parent differs';
};

export function channelSteps(ctx: Ctx): Step[] {
  return CHANNELS.map((c) => ({ name: `channel ${c.key}`, run: () => ensureKeyed(ctx, 'channels', c, diffChannel) }));
}

export function taxSteps(ctx: Ctx): Step[] {
  return TAX_CATEGORIES.map((t) => ({ name: `tax category ${t.key}`, run: () => ensureKeyed(ctx, 'taxCategories', t, diffTax) }));
}

/** Creates the states, then sets each one's transitions (state keys cannot be referenced before they exist). */
export function stateSteps(ctx: Ctx): Step[] {
  const create = STATES.map((s) => ({ name: `state ${s.key}`, run: () => ensureKeyed(ctx, 'states', stateDraft(s), (e, d) => pickDiff(e, d, ['type', 'initial'])) }));
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
    ...CUSTOM_TYPES.map((t) => ({ name: `type ${t.key}`, run: () => ensureKeyed(ctx, 'types', t, diffType) })),
    ...PRODUCT_TYPES.map((t) => ({ name: `product type ${t.key}`, run: () => ensureKeyed(ctx, 'productTypes', t, diffProductType) })),
  ];
}

export function categorySteps(ctx: Ctx): Step[] {
  const drafts = categoryDrafts();
  return drafts.map((d, i) => ({ name: `category ${CATEGORIES[i].key}`, run: () => ensureKeyed(ctx, 'categories', d, diffCategory) }));
}

export const foundationSteps = (ctx: Ctx): Step[] => [...channelSteps(ctx), ...taxSteps(ctx), ...stateSteps(ctx), ...typeSteps(ctx), ...categorySteps(ctx)];
