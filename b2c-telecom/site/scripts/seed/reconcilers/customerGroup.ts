import { COLLECTION, asReconciler, type CustomerGroupDraft } from '../types';
import { getByKey, postUpdate, removeByKey, type Versioned } from './util';

const COLL = COLLECTION.customerGroup;

type ExistingGroup = Versioned & { name: string };

export const customerGroupReconciler = asReconciler<CustomerGroupDraft, ExistingGroup>({
  kind: 'customerGroup',
  order: 40,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingGroup>(api, COLL, key),
  create: async (api, draft) => void (await api.post(COLL, { key: draft.key, groupName: draft.groupName })),
  diff: (existing, draft) => (existing.name === draft.groupName ? { changes: [] } : { changes: [{ path: 'groupName', from: existing.name, to: draft.groupName }] }),
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, [{ action: 'changeName', name: draft.groupName }]),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
