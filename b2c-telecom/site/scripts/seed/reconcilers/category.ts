import { COLLECTION, asReconciler, type CategoryDraft } from '../types';
import { deepEqual, field, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.category;

type ExistingAsset = { id?: string; key?: string; name?: Record<string, string>; sources?: { uri: string }[] };
type ExistingCategory = Versioned &
  Pick<CategoryDraft, 'name' | 'slug' | 'description' | 'orderHint'> & { parent?: { id: string; obj?: Obj & { key?: string } }; ancestors?: unknown[]; assets?: ExistingAsset[] };

export function planCategory(existing: ExistingCategory, draft: CategoryDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (field(changes, 'name', existing.name, draft.name)) actions.push({ action: 'changeName', name: draft.name });
  if (field(changes, 'slug', existing.slug, draft.slug)) actions.push({ action: 'changeSlug', slug: draft.slug });
  if (field(changes, 'description', existing.description, draft.description)) actions.push({ action: 'setDescription', description: draft.description });
  if (field(changes, 'orderHint', existing.orderHint, draft.orderHint)) actions.push({ action: 'changeOrderHint', orderHint: draft.orderHint });
  if (draft.parent !== undefined && field(changes, 'parent', existing.parent?.obj?.key, draft.parent)) {
    actions.push({ action: 'changeParent', parent: { typeId: 'category', key: draft.parent } });
  }
  if (draft.assets !== undefined) {
    const have = existing.assets ?? [];
    for (const wanted of draft.assets) {
      const current = have.find((a) => a.key === wanted.key);
      if (!current) {
        changes.push({ path: `assets.${wanted.key}`, from: undefined, to: wanted.sources.map((s) => s.uri) });
        actions.push({ action: 'addAsset', asset: wanted });
        continue;
      }
      if (field(changes, `assets.${wanted.key}.name`, current.name, wanted.name)) actions.push({ action: 'changeAssetName', assetKey: wanted.key, name: wanted.name });
      const haveUris = (current.sources ?? []).map((s) => s.uri);
      const wantUris = wanted.sources.map((s) => s.uri);
      if (!deepEqual(haveUris, wantUris)) {
        changes.push({ path: `assets.${wanted.key}.sources`, from: haveUris, to: wantUris });
        actions.push({ action: 'setAssetSources', assetKey: wanted.key, sources: wanted.sources });
      }
    }
    const prefix = `${draft.key}-image-`;
    for (const current of have) {
      if (current.key?.startsWith(prefix) && !draft.assets.some((a) => a.key === current.key)) {
        changes.push({ path: `assets.${current.key}`, from: 'present', to: undefined });
        actions.push({ action: 'removeAsset', assetKey: current.key });
      }
    }
  }
  return { changes, actions };
}

export const categoryReconciler = asReconciler<CategoryDraft, ExistingCategory>({
  kind: 'category',
  order: 60,
  refs: (d) => (d.parent ? [{ kind: 'category', key: d.parent, from: { kind: 'category', key: d.key } }] : []),
  fetch: (api, key) => getByKey<ExistingCategory>(api, COLL, key, { expand: 'parent' }),
  create: async (api, draft) => {
    const { parent, ...rest } = draft;
    await api.post(COLL, { ...rest, ...(parent ? { parent: { typeId: 'category', key: parent } } : {}) });
  },
  diff: (existing, draft) => ({ changes: planCategory(existing, draft).changes }),
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planCategory(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
