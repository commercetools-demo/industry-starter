import 'server-only';
import type { Cart, CartUpdateAction, CustomFields, Order, OrderUpdateAction } from '@commercetools/platform-sdk';
import { isInstore } from '@/lib/app-mode';
import { apiRoot } from '@/lib/ct/client';
import { updateWithRetry } from '@/lib/ct/retry';

/**
 * The order type of a cart or an order (workstream R, decisions D-042, D-043, D-047).
 *
 * Every cart made in the In-store companion carries `custom: { type: { key: 'instore-order-type' }, fields: { orderType:
 * 'in-store-purchase' } }`. The type is created by the seed (types step) or in Merchant Center; until it exists the storefront
 * must not break: it logs once, skips the field, and the shopper notices nothing. The check reads the type by key (scope
 * `view_types`) and is cached, so creating the type needs no redeploy.
 */
export const ORDER_TYPE_KEY = 'instore-order-type';
export const ORDER_TYPE_FIELD = 'orderType';
export const IN_STORE_PURCHASE = 'in-store-purchase';

export interface OrderTypeCustom {
  type: { typeId: 'type'; key: string };
  fields: { orderType: string };
}

const CUSTOM: OrderTypeCustom = {
  type: { typeId: 'type', key: ORDER_TYPE_KEY },
  fields: { orderType: IN_STORE_PURCHASE },
};

const PRESENT_MS = 5 * 60 * 1000;
const MISSING_MS = 60 * 1000;
const FAILED_MS = 15 * 1000;

type Lookup = { id: string | null; until: number };
let cached: Lookup | null = null;
let loggedMissing = false;

/** Test seam: forget the cached lookup and the "logged once" flag. */
export function resetOrderTypeCache(): void {
  cached = null;
  loggedMissing = false;
}

/** The id of the type, or null when the project does not have it (or could not be read). Never throws. */
async function typeId(): Promise<string | null> {
  const now = Date.now();
  if (cached && cached.until > now) return cached.id;
  try {
    const { body } = await apiRoot.types().withKey({ key: ORDER_TYPE_KEY }).get().execute();
    cached = { id: body.id, until: now + PRESENT_MS };
    loggedMissing = false;
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404) {
      if (!loggedMissing) {
        loggedMissing = true;
        console.warn(JSON.stringify({ event: 'instore_order_type_missing', key: ORDER_TYPE_KEY }));
      }
      cached = { id: null, until: now + MISSING_MS };
    } else {
      // A network or permission problem is not "missing": ask again soon, and say so once per window.
      console.warn(JSON.stringify({ event: 'instore_order_type_check_failed', status }));
      cached = { id: null, until: now + FAILED_MS };
    }
  }
  return cached.id;
}

/** True when this deploy is the In-store companion and the project has the type. */
export async function orderTypeActive(): Promise<boolean> {
  return isInstore() && (await typeId()) !== null;
}

/** The `custom` of a new cart, or undefined (website mode, or the type does not exist yet). */
export async function orderTypeCustom(): Promise<OrderTypeCustom | undefined> {
  return (await orderTypeActive()) ? { type: { ...CUSTOM.type }, fields: { ...CUSTOM.fields } } : undefined;
}

/** A cart draft with the order type fields when they apply. The draft is not changed. */
export async function withOrderType<T extends object>(draft: T): Promise<T & { custom?: OrderTypeCustom }> {
  const custom = await orderTypeCustom();
  return custom ? { ...draft, custom } : draft;
}

type SetAction =
  | { action: 'setCustomType'; type: OrderTypeCustom['type']; fields: OrderTypeCustom['fields'] }
  | { action: 'setCustomField'; name: string; value: string };

/**
 * Pure. The update actions that make a resource carry `orderType = in-store-purchase`:
 *  - no custom type yet: `setCustomType` with the field;
 *  - our type with another or no value: `setCustomField`;
 *  - already right: nothing;
 *  - another custom type (the platform allows one per resource): nothing. Foreign data is never overwritten.
 */
export function planOrderTypeActions(custom: CustomFields | undefined, ourTypeId: string): SetAction[] {
  if (!custom) return [{ action: 'setCustomType', type: { ...CUSTOM.type }, fields: { ...CUSTOM.fields } }];
  if (custom.type.id !== ourTypeId) return [];
  if (custom.fields?.[ORDER_TYPE_FIELD] === IN_STORE_PURCHASE) return [];
  return [{ action: 'setCustomField', name: ORDER_TYPE_FIELD, value: IN_STORE_PURCHASE }];
}

/** Actions for an existing cart (empty in website mode, when the type is missing, or when the cart is already right). */
export async function orderTypeCartActions(cart: Pick<Cart, 'custom'>): Promise<CartUpdateAction[]> {
  if (!isInstore()) return [];
  const id = await typeId();
  if (id === null) return [];
  const actions = planOrderTypeActions(cart.custom, id);
  if (actions.length === 0 && cart.custom && cart.custom.type.id !== id) {
    console.warn(JSON.stringify({ event: 'instore_order_type_foreign_custom_type' }));
  }
  return actions as CartUpdateAction[];
}

/**
 * Post-order hook (D-042). The hosted Checkout places the order from the cart, and the documentation does not say that the platform
 * copies `Cart.custom` to the order, so an in-store order that lacks the field gets it here (one update, one retry on a conflict).
 * Orders of other modes and orders that already carry the value are not touched. A failure is logged by the caller and never fails
 * the order.
 */
export async function ensureOrderType(order: { id: string; orderType?: string | null }): Promise<void> {
  if (!isInstore() || order.orderType === IN_STORE_PURCHASE) return;
  const id = await typeId();
  if (id === null) return;
  await updateWithRetry(
    async () => (await apiRoot.orders().withId({ ID: order.id }).get().execute()).body as Order,
    async (current) => {
      const actions = planOrderTypeActions(current.custom, id) as OrderUpdateAction[];
      if (actions.length === 0) return current;
      return (await apiRoot.orders().withId({ ID: current.id }).post({ body: { version: current.version, actions } }).execute()).body;
    },
  );
}
