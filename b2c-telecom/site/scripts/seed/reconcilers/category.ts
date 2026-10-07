import { COLLECTION, asReconciler, type CategoryDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type Obj, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.category;

type ExistingCategory = Versioned &
  Pick<CategoryDraft, 'name' | 'slug' | 'description' | 'orderHint'> & { parent?: { id: string; obj?: Obj & { key?: string } }; ancestors?: unknown[] };

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
