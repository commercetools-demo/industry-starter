import { COLLECTION, asReconciler, type ChannelDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.channel;
const ROLES = ['ProductDistribution'];

type ExistingChannel = Versioned & { name?: Record<string, string>; roles?: string[] };

export function planChannel(existing: ExistingChannel, draft: ChannelDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  // A channel without the ProductDistribution role cannot be a line item's distribution channel.
  if (!(existing.roles ?? []).includes(ROLES[0] as string)) {
    changes.push({ path: 'roles', from: existing.roles, to: ROLES });
    actions.push({ action: 'addRoles', roles: ROLES });
  }
  return { changes, actions };
}

export const channelReconciler = asReconciler<ChannelDraft, ExistingChannel>({
  kind: 'channel',
  order: 35,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingChannel>(api, COLL, key),
  create: async (api, draft) => void (await api.post(COLL, { key: draft.key, name: draft.name, roles: ROLES })),
  diff: (existing, draft) => ({ changes: planChannel(existing, draft).changes }),
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planChannel(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
