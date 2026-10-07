import { COLLECTION, asReconciler, type RecurrencePolicyDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.recurrencePolicy;

type ExistingPolicy = Versioned & Pick<RecurrencePolicyDraft, 'name' | 'description' | 'schedule'>;

export function planPolicy(existing: ExistingPolicy, draft: RecurrencePolicyDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'setName', name: draft.name });
  if (field(changes, 'description', existing.description, draft.description)) actions.push({ action: 'setDescription', description: draft.description });
  if (field(changes, 'schedule', existing.schedule, draft.schedule)) actions.push({ action: 'setSchedule', schedule: draft.schedule });
  return { changes, actions };
}

export const recurrencePolicyReconciler = asReconciler<RecurrencePolicyDraft, ExistingPolicy>({
  kind: 'recurrencePolicy',
  order: 40,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingPolicy>(api, COLL, key),
  create: async (api, draft) => void (await api.post(COLL, draft)),
  diff: (existing, draft) => ({ changes: planPolicy(existing, draft).changes }),
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planPolicy(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
