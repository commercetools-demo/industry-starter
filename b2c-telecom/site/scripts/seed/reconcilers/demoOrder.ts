// Demo orders (only with --with-demo): what the demo customers already hold (D-021). An order is immutable: an existing
// orderNumber is `unchanged`. Created as cart -> order, so a recurring line makes the platform create a Recurring Order
// (verified live in G-18). The cart is typed malva-order from the start (the type is a superset of malva-cart, so its
// fields survive the handover; G-18 showed OrderFromCartDraft.custom cannot change the type).
import { DEMO_MARKER_VALUE } from '../../../lib/config/demo';
import { demoOrders } from '../data/demo/orders';
import { CtHttpError, type CtApi } from '../lib';
import { COLLECTION, asReconciler, type DemoOrderDraft } from '../types';
import { type Obj, type Versioned } from './util';

const ORDERS = COLLECTION.demoOrder;

type ExistingOrder = Versioned & { orderNumber?: string };

const orderNumberOf = (key: string): string => demoOrders.find((o) => o.key === key)?.orderNumber ?? key;
export const cartKeyOf = (draft: DemoOrderDraft): string => `malva-demo-cart-${draft.orderNumber.slice(-4)}`;

const recurrenceInfo = (policy: string, mode: string): Obj => ({ recurrencePolicy: { typeId: 'recurrence-policy', key: policy }, priceSelectionMode: mode });

export async function buildCart(api: CtApi, draft: DemoOrderDraft): Promise<Obj> {
  const customer = (await api.get(`customers/key=${draft.customer}`)) as { id: string; email: string; addresses?: Obj[] } | null;
  if (!customer) throw new Error(`demo customer "${draft.customer}" does not exist`);
  const { id: _id, key: _key, ...address } = (customer.addresses?.[0] ?? { country: draft.country }) as Obj;
  void _id;
  void _key;
  const independent = draft.lines.filter((l) => l.parentLine === undefined);
  let cart = (await api.post('carts', {
    key: cartKeyOf(draft),
    currency: draft.currency,
    country: draft.country,
    customerId: customer.id,
    customerEmail: customer.email,
    inventoryMode: 'None',
    shippingAddress: address,
    billingAddress: address,
    lineItems: independent.map((l) => ({
      sku: l.sku,
      quantity: l.quantity,
      recurrenceInfo: recurrenceInfo(l.recurrencePolicy, l.priceSelectionMode),
      custom: { type: { typeId: 'type', key: 'malva-line-item' }, fields: { offerKey: l.offerKey } },
    })),
    custom: {
      type: { typeId: 'type', key: 'malva-order' },
      fields: { serviceStartDate: draft.serviceStartDate, priceSchedule: draft.priceSchedule, demoMarker: DEMO_MARKER_VALUE },
    },
  })) as Obj;
  for (const line of draft.lines) {
    if (line.parentLine === undefined) continue;
    const parentSku = draft.lines[line.parentLine].sku;
    const parent = (cart.lineItems as { id: string; variant?: { sku?: string } }[]).find((l) => l.variant?.sku === parentSku);
    if (!parent) throw new Error(`parent line ${parentSku} of ${line.sku} is not in the cart`);
    cart = (await api.post(`carts/${String(cart.id)}`, {
      version: cart.version,
      actions: [
        {
          action: 'addLineItem',
          sku: line.sku,
          quantity: line.quantity,
          recurrenceInfo: recurrenceInfo(line.recurrencePolicy, line.priceSelectionMode),
          custom: { type: { typeId: 'type', key: 'malva-line-item' }, fields: { offerKey: line.offerKey, parentLineItemId: parent.id } },
        },
      ],
    })) as Obj;
  }
  return cart;
}

export const demoOrderReconciler = asReconciler<DemoOrderDraft, ExistingOrder>({
  kind: 'demoOrder',
  order: 120,
  refs: (d) => [
    { kind: 'demoCustomer', key: d.customer, from: { kind: 'demoOrder', key: d.key } },
    { kind: 'type', key: 'malva-order', from: { kind: 'demoOrder', key: d.key } },
    { kind: 'type', key: 'malva-line-item', from: { kind: 'demoOrder', key: d.key } },
    ...[...new Set(d.lines.map((l) => l.recurrencePolicy))].map((key) => ({ kind: 'recurrencePolicy' as const, key, from: { kind: 'demoOrder' as const, key: d.key } })),
  ],
  fetch: async (api, key) => (await api.get(`${ORDERS}/order-number=${orderNumberOf(key)}`)) as ExistingOrder | null,
  create: async (api, draft) => {
    const cart = await buildCart(api, draft);
    try {
      await api.post(ORDERS, { cart: { typeId: 'cart', id: cart.id }, version: cart.version, orderNumber: draft.orderNumber, orderState: 'Confirmed' });
    } catch (err) {
      // do not leave a half-made cart behind: the next run starts clean
      await api.del(`carts/${String(cart.id)}`, { version: Number(cart.version) }).catch(() => undefined);
      throw err;
    }
  },
  diff: () => ({ changes: [] }),
  update: async () => undefined,
  remove: async (api, existing) => {
    try {
      await api.del(`${ORDERS}/${existing.id}`, { version: existing.version });
    } catch (err) {
      if (!(err instanceof CtHttpError && err.statusCode === 404)) throw err;
    }
  },
});
