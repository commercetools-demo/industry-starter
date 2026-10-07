import { COLLECTION, asReconciler, type DiscountCodeDraft } from '../types';
import { deepEqual, field, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.discountCode;

type ExistingCode = Versioned &
  Omit<Partial<DiscountCodeDraft>, 'cartDiscounts'> & { cartDiscounts: { id: string; obj?: Obj & { key?: string } }[] };

export function planDiscountCode(existing: ExistingCode, draft: DiscountCodeDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (existing.code !== draft.code) return { changes, actions, conflict: `code is immutable (existing "${existing.code}", manifest "${draft.code}")` };
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'setName', name: draft.name });
  if (field(changes, 'description', existing.description, draft.description)) actions.push({ action: 'setDescription', description: draft.description });
  const haveKeys = existing.cartDiscounts.map((c) => c.obj?.key);
  if (!deepEqual(haveKeys, draft.cartDiscounts)) {
    changes.push({ path: 'cartDiscounts', from: haveKeys, to: draft.cartDiscounts });
    actions.push({ action: 'changeCartDiscounts', cartDiscounts: draft.cartDiscounts.map((key) => ({ typeId: 'cart-discount', key })) });
  }
  if (field(changes, 'cartPredicate', existing.cartPredicate, draft.cartPredicate)) actions.push({ action: 'setCartPredicate', cartPredicate: draft.cartPredicate });
  if (field(changes, 'isActive', existing.isActive, draft.isActive)) actions.push({ action: 'changeIsActive', isActive: draft.isActive });
  if (field(changes, 'maxApplications', existing.maxApplications, draft.maxApplications)) actions.push({ action: 'setMaxApplications', maxApplications: draft.maxApplications });
  if (field(changes, 'maxApplicationsPerCustomer', existing.maxApplicationsPerCustomer, draft.maxApplicationsPerCustomer)) {
    actions.push({ action: 'setMaxApplicationsPerCustomer', maxApplicationsPerCustomer: draft.maxApplicationsPerCustomer });
  }
  const from = field(changes, 'validFrom', existing.validFrom, draft.validFrom);
  const until = field(changes, 'validUntil', existing.validUntil, draft.validUntil);
  if (from || until) actions.push({ action: 'setValidFromAndUntil', validFrom: draft.validFrom ?? existing.validFrom, validUntil: draft.validUntil ?? existing.validUntil });
  return { changes, actions };
}

export const discountCodeReconciler = asReconciler<DiscountCodeDraft, ExistingCode>({
  kind: 'discountCode',
  order: 100,
  refs: (d) => d.cartDiscounts.map((key) => ({ kind: 'cartDiscount' as const, key, from: { kind: 'discountCode' as const, key: d.key } })),
  fetch: (api, key) => getByKey<ExistingCode>(api, COLL, key, { expand: 'cartDiscounts[*]' }),
  create: async (api, draft) => {
    const { cartDiscounts, ...rest } = draft;
    await api.post(COLL, { ...rest, cartDiscounts: cartDiscounts.map((key) => ({ typeId: 'cart-discount', key })) });
  },
  diff: (existing, draft) => {
    const { changes, conflict } = planDiscountCode(existing, draft);
    return { changes, ...(conflict ? { conflict } : {}) };
  },
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planDiscountCode(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
