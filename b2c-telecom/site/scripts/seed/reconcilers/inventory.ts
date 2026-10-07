import { COLLECTION, asReconciler, type InventoryDraft } from '../types';
import { field, getByKey, postUpdate, removeByKey, type UpdateAction, type UpdatePlan, type Versioned } from './util';

const COLL = COLLECTION.inventory;

type ExistingInventory = Versioned & { sku: string; quantityOnStock: number; restockableInDays?: number };

/** Inventory entries are keyed `malva-inv-<sku>`. */
export function inventoryKey(sku: string): string {
  return `malva-inv-${sku}`;
}

export function planInventory(existing: ExistingInventory, draft: InventoryDraft): UpdatePlan {
  const changes: UpdatePlan['changes'] = [];
  const actions: UpdateAction[] = [];
  if (existing.sku !== draft.sku) return { changes, actions, conflict: `sku differs for key "${draft.key}" (existing "${existing.sku}", manifest "${draft.sku}")` };
  if (field(changes, 'quantityOnStock', existing.quantityOnStock, draft.quantityOnStock)) actions.push({ action: 'changeQuantity', quantity: draft.quantityOnStock });
  if (field(changes, 'restockableInDays', existing.restockableInDays, draft.restockableInDays)) {
    actions.push({ action: 'setRestockableInDays', restockableInDays: draft.restockableInDays });
  }
  return { changes, actions };
}

export const inventoryReconciler = asReconciler<InventoryDraft, ExistingInventory>({
  kind: 'inventory',
  order: 90,
  refs: () => [],
  fetch: (api, key) => getByKey<ExistingInventory>(api, COLL, key),
  create: async (api, draft) =>
    void (await api.post(COLL, {
      key: draft.key,
      sku: draft.sku,
      quantityOnStock: draft.quantityOnStock,
      ...(draft.restockableInDays !== undefined ? { restockableInDays: draft.restockableInDays } : {}),
    })),
  diff: (existing, draft) => {
    const { changes, conflict } = planInventory(existing, draft);
    return { changes, ...(conflict ? { conflict } : {}) };
  },
  update: async (api, existing, _changes, draft) => postUpdate(api, COLL, existing, planInventory(existing, draft).actions),
  remove: (api, existing) => removeByKey(api, COLL, existing),
});
