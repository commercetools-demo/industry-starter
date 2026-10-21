import type { VariantView } from '@/lib/types';

export type Fulfilment = 'delivery' | 'collect' | 'subscribe';

/** Message key under `pdp.add.*` (plus the `error` state for a failed stock read). */
export type AddKey =
  | 'select' | 'priceOnRequest' | 'chooseStore' | 'unavailableCollect' | 'outOfStock' | 'stockUnknown'
  | 'reserve' | 'addToBag' | 'subscribe';

export interface AddState {
  key: AddKey;
  disabled: boolean;
  /** Label gets ` - {line total}` only when the button can be pressed to commit a line. */
  showTotal: boolean;
}

export interface AddInput {
  /** Label of the first unselected required choice (grind, colour...), when any. */
  missingChoice?: string;
  variant: VariantView | null;
  fulfilment: Fulfilment;
  /** A store is chosen (collect only). */
  storeChannelId?: string;
  quantity: number;
  /** The inventory read failed: never claim stock. */
  inventoryFailed?: boolean;
  /** Subscribe selected but no policy can be chosen (no recurring price). */
  noPolicy?: boolean;
}

const done = (key: AddKey, disabled: boolean, showTotal = false): AddState => ({ key, disabled, showTotal });

/**
 * State of the add button, in the priority order of the spec (workstream H, 3.8): a missing required choice, no price,
 * collect without a store (enabled, it opens the picker), collect with too little stock at the store, delivery or
 * subscribe with no online stock, then the enabled label of the chosen fulfilment. Pure.
 */
export function addButtonState(i: AddInput): AddState {
  if (i.missingChoice !== undefined || !i.variant) return done('select', true);
  if (!i.variant.price) return done('priceOnRequest', true);
  if (i.inventoryFailed) return done('stockUnknown', true);
  if (i.fulfilment === 'collect') {
    if (!i.storeChannelId) return done('chooseStore', false);
    if ((i.variant.stock.stores[i.storeChannelId] ?? 0) < i.quantity) return done('unavailableCollect', true);
    return done('reserve', false, true);
  }
  if (i.variant.stock.online < i.quantity) return done('outOfStock', true);
  if (i.fulfilment === 'subscribe') return i.noPolicy ? done('priceOnRequest', true) : done('subscribe', false, true);
  return done('addToBag', false, true);
}

/** Largest quantity the stepper allows for the active fulfilment (stock, `maxCartQuantity` and the page maximum). */
export function maxQuantity(variant: VariantView | null, fulfilment: Fulfilment, storeChannelId: string | undefined, pageMax: number): number {
  if (!variant) return pageMax;
  const stock = fulfilment === 'collect' ? (storeChannelId ? (variant.stock.stores[storeChannelId] ?? 0) : pageMax) : variant.stock.online;
  const cap = variant.stock.maxQty ?? pageMax;
  return Math.max(1, Math.min(pageMax, cap, stock > 0 ? stock : 1));
}

/** Smallest quantity (inventory `minCartQuantity`, otherwise 1). */
export function minQuantity(variant: VariantView | null): number {
  return Math.max(1, variant?.stock.minQty ?? 1);
}
