import { COLLECTION, asReconciler, type TaxCategoryDraft, type TaxRateDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.taxCategory;

type ExistingRate = TaxRateDraft & { id: string };
type ExistingTax = Versioned & { name: string; description?: string; rates: ExistingRate[] };

function rateDiffers(a: ExistingRate, b: TaxRateDraft): boolean {
  return a.name !== b.name || a.amount !== b.amount || a.includedInPrice !== b.includedInPrice || a.country !== b.country;
}

export function planTax(existing: ExistingTax, draft: TaxCategoryDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (field(changes, 'description', existing.description, draft.description)) actions.push({ action: 'setDescription', description: draft.description });
  for (const wanted of draft.rates) {
    const current = existing.rates.find((r) => r.key === wanted.key);
    if (!current) {
      changes.push({ path: `rates.${wanted.key}`, from: undefined, to: wanted });
      actions.push({ action: 'addTaxRate', taxRate: wanted });
    } else if (rateDiffers(current, wanted)) {
      changes.push({ path: `rates.${wanted.key}`, from: { amount: current.amount, includedInPrice: current.includedInPrice }, to: { amount: wanted.amount, includedInPrice: wanted.includedInPrice } });
      actions.push({ action: 'replaceTaxRate', taxRateId: current.id, taxRate: wanted });
    }
  }
  for (const current of existing.rates) {
    if (current.key && !draft.rates.some((r) => r.key === current.key)) {
      changes.push({ path: `rates.${current.key}`, from: current, to: undefined });
      actions.push({ action: 'removeTaxRate', taxRateId: current.id });
    }
  }
  return { changes, actions };
}

export const taxCategoryReconciler = asReconciler<TaxCategoryDraft, ExistingTax>({
  kind: 'taxCategory',
  order: 20,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingTax>(api, COLL, key),
  create: async (api, draft) => void (await api.post(COLL, draft)),
  diff: (existing, draft) => ({ changes: planTax(existing, draft).changes }),
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planTax(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
