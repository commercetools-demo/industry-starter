import 'server-only';
import type { CartUpdateAction } from '@commercetools/platform-sdk';

/**
 * The pure cart actions of a preset bundle (workstream V, D2, D3). No commercetools call here: lib/ct/cart.ts sends them.
 * The parent carries the bundle's price and the preset fields; every part is a $0 child with `parentId` = the parent key.
 */

const LINE_TYPE = { typeId: 'type', key: 'mcf-line-fulfilment' } as const;
const BRAND = 'malva-coffee';

export interface PresetBundlePlan {
  /** The bundle product SKU (the parent line). */
  parentSku: string;
  /** The parent line key, `bundle-<uuid>`. */
  key: string;
  quantity: number;
  presetIndex: number;
  /** The preset discount as a fraction (0.1 = 10 %). */
  discount: number;
  wasCents: number;
  priceCents: number;
  currency: string;
  fulfilment: 'delivery' | 'collect';
  /** The store channel id for a collect bundle (every line carries it). */
  storeChannelId?: string;
  /** The chosen machine variant (D-059). */
  machineSku: string;
  /** The master SKUs of the pods, in preset order. */
  podSkus: string[];
}

const supply = (storeChannelId: string | undefined) => (storeChannelId ? { supplyChannel: { typeId: 'channel' as const, id: storeChannelId } } : {});

/** The `addLineItem` actions for one new bundle: the parent first, then the machine and every pod at $0. */
export function buildPresetBundleActions(plan: PresetBundlePlan): CartUpdateAction[] {
  const fields = (extra: Record<string, unknown>) => ({
    type: LINE_TYPE,
    fields: { fulfilment: plan.fulfilment, brand: BRAND, ...extra },
  });
  const parent: CartUpdateAction = {
    action: 'addLineItem',
    sku: plan.parentSku,
    quantity: plan.quantity,
    key: plan.key,
    externalPrice: { currencyCode: plan.currency, centAmount: plan.priceCents },
    custom: fields({
      bundlePreset: String(plan.presetIndex),
      bundleDiscount: plan.discount,
      bundleWasCents: plan.wasCents,
      bundleMachineSku: plan.machineSku,
    }),
    ...supply(plan.storeChannelId),
  };
  const children = [plan.machineSku, ...plan.podSkus].map(
    (sku): CartUpdateAction => ({
      action: 'addLineItem',
      sku,
      quantity: plan.quantity,
      externalPrice: { currencyCode: plan.currency, centAmount: 0 },
      custom: fields({ parentId: plan.key }),
      ...supply(plan.storeChannelId),
    }),
  );
  return [parent, ...children];
}

/** The quantity raise of an existing bundle: the parent and every child go up by `add` in one update. */
export function buildRaiseBundleActions(
  parent: { id: string; quantity: number },
  children: { id: string; quantity: number }[],
  add: number,
): CartUpdateAction[] {
  return [parent, ...children].map((line) => ({
    action: 'changeLineItemQuantity',
    lineItemId: line.id,
    quantity: line.quantity + add,
  }));
}
