import { CtHttpError } from '../lib';
import { COLLECTION, SkipError, asReconciler, type CartDiscountDraft } from '../types';
import { covers, field, getAll, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.cartDiscount;

type ExistingDiscount = Versioned & Obj & Partial<Omit<CartDiscountDraft, 'key'>>;

export function planCartDiscount(existing: ExistingDiscount, draft: CartDiscountDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (field(changes, 'description', existing.description, draft.description)) actions.push({ action: 'setDescription', description: draft.description });
  if (!covers(existing.value, draft.value)) {
    changes.push({ path: 'value', from: existing.value, to: draft.value });
    actions.push({ action: 'changeValue', value: draft.value });
  }
  if (field(changes, 'cartPredicate', existing.cartPredicate, draft.cartPredicate)) actions.push({ action: 'changeCartPredicate', cartPredicate: draft.cartPredicate });
  if (draft.target && !covers(existing.target, draft.target)) {
    changes.push({ path: 'target', from: existing.target, to: draft.target });
    actions.push({ action: 'changeTarget', target: draft.target });
  }
  if (field(changes, 'sortOrder', existing.sortOrder, draft.sortOrder)) actions.push({ action: 'changeSortOrder', sortOrder: draft.sortOrder });
  if (field(changes, 'stackingMode', existing.stackingMode, draft.stackingMode)) actions.push({ action: 'changeStackingMode', stackingMode: draft.stackingMode });
  if (field(changes, 'isActive', existing.isActive, draft.isActive)) actions.push({ action: 'changeIsActive', isActive: draft.isActive });
  if (field(changes, 'requiresDiscountCode', existing.requiresDiscountCode, draft.requiresDiscountCode)) {
    actions.push({ action: 'changeRequiresDiscountCode', requiresDiscountCode: draft.requiresDiscountCode });
  }
  const validFromChanged = field(changes, 'validFrom', existing.validFrom, draft.validFrom);
  const validUntilChanged = field(changes, 'validUntil', existing.validUntil, draft.validUntil);
  if (validFromChanged || validUntilChanged) {
    actions.push({ action: 'setValidFromAndUntil', validFrom: draft.validFrom ?? existing.validFrom, validUntil: draft.validUntil ?? existing.validUntil });
  }
  if (draft.recurringOrderScope && !covers(existing.recurringOrderScope, draft.recurringOrderScope)) {
    changes.push({ path: 'recurringOrderScope', from: existing.recurringOrderScope, to: draft.recurringOrderScope });
    actions.push({ action: 'setRecurringOrderScope', recurringOrderScope: draft.recurringOrderScope });
  }
  return { changes, actions };
}

/** The platform enforces a unique sortOrder: turn that failure into a named conflict. */
async function explainSortOrder(api: Parameters<typeof getAll>[0], draft: CartDiscountDraft, err: unknown): Promise<never> {
  const duplicate = err instanceof CtHttpError && err.statusCode === 400 && /sortOrder/i.test(err.message);
  if (!duplicate) throw err;
  const others = await getAll(api, COLL, { where: `sortOrder="${draft.sortOrder}"` });
  const other = others.find((o) => o.key !== draft.key);
  throw new SkipError(`sortOrder "${draft.sortOrder}" is already used by cart discount "${String(other?.key ?? other?.id ?? 'unknown')}"`);
}

export const cartDiscountReconciler = asReconciler<CartDiscountDraft, ExistingDiscount>({
  kind: 'cartDiscount',
  order: 100,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingDiscount>(api, COLL, key),
  create: async (api, draft) => {
    try {
      await api.post(COLL, draft);
    } catch (err) {
      await explainSortOrder(api, draft, err);
    }
  },
  diff: (existing, draft) => ({ changes: planCartDiscount(existing, draft).changes }),
  update: async (api, existing, _changes, draft) => {
    try {
      await postUpdate(api, COLL, existing, planCartDiscount(existing, draft).actions);
    } catch (err) {
      await explainSortOrder(api, draft, err);
    }
  },
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
