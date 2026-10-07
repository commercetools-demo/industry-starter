// Custom Objects (the serviceability table, D-020): upsert by container + key. The draft key is the object key (a postal
// code); the container is fixed to the Malva serviceability container, so the reconciler can fetch by key alone.
import { SERVICEABILITY_CONTAINER } from '../data/serviceability';
import { asReconciler, type Change, type CustomObjectDraft } from '../types';
import { deepEqual, type Versioned } from './util';

type ExistingObject = Versioned & { container: string; key: string; value: unknown };

const path = (key: string): string => `custom-objects/${SERVICEABILITY_CONTAINER}/${key}`;

export const customObjectReconciler = asReconciler<CustomObjectDraft, ExistingObject>({
  kind: 'customObject',
  order: 25,
  refs: () => [],
  fetch: async (api, key) => (await api.get(path(key))) as ExistingObject | null,
  create: async (api, draft) => void (await api.post('custom-objects', { container: draft.container, key: draft.key, value: draft.value })),
  diff: (existing, draft) => {
    const changes: Change[] = [];
    if (existing.container !== draft.container) return { changes, conflict: `container differs (existing "${existing.container}", manifest "${draft.container}")` };
    if (!deepEqual(existing.value, draft.value)) changes.push({ path: 'value', from: existing.value, to: draft.value });
    return { changes };
  },
  update: async (api, existing, _changes, draft) => void (await api.post('custom-objects', { container: draft.container, key: draft.key, value: draft.value, version: existing.version })),
  remove: async (api, existing) => void (await api.del(path(existing.key), { version: existing.version })),
});
