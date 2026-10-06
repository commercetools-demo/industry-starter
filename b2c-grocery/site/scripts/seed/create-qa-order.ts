import { randomBytes } from 'node:crypto';
import type { CartDraft, CustomerDraft, OrderFromCartDraft } from '@commercetools/platform-sdk';
import { getAdminRoot, type Root } from './lib';

/**
 * Creates a throwaway QA customer with a paid-looking order (two seeded products, the `standard` shipping method and a
 * delivery slot on the `cart-delivery` custom type), so account pages, order detail and the browser tests have real data.
 *
 *   npx tsx scripts/seed/create-qa-order.ts [--status processing|packing|on-its-way|delivered|cancelled] [--orders N] [--final-cents N]
 *
 * Prints only non-secret ids, the QA email and the fixed throwaway password. Delete everything with
 * `npx tsx scripts/seed/cleanup-qa.ts` (customers `qa-*@example.com`, their orders and carts).
 *
 * `--final-cents N` records the weighed amount (`finalTotal`, USD) as a custom field of the `cart-delivery` type (D-051).
 */
export const QA_PASSWORD = 'Qa-Throwaway-9Xq!';
export const QA_SKUS = ['BANANAS-500G', 'WHOLE-MILK-1EACH'] as const;

export type QaStatus = 'processing' | 'packing' | 'on-its-way' | 'delivered' | 'cancelled';
export const QA_STATUSES: QaStatus[] = ['processing', 'packing', 'on-its-way', 'delivered', 'cancelled'];

export const qaEmail = (random: string = randomBytes(5).toString('hex')): string => `qa-${random}@example.com`;

const address = (email: string) => ({
  firstName: 'Qa',
  lastName: 'Tester',
  streetName: '1 Main St',
  postalCode: '10001',
  city: 'New York',
  country: 'US',
  email,
});

export function qaCustomerDraft(email: string): CustomerDraft {
  return {
    email,
    password: QA_PASSWORD,
    firstName: 'Qa',
    lastName: 'Tester',
    addresses: [address(email)],
    defaultShippingAddress: 0,
    shippingAddresses: [0],
  };
}

/** Tomorrow (UTC) 10:00-12:00 in the slot id format `YYYY-MM-DD-HH` used by the stub slot service. */
export function qaSlot(now: Date = new Date()): { slotId: string; slotStart: string; slotEnd: string } {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const date = day.toISOString().slice(0, 10);
  return { slotId: `${date}-10`, slotStart: `${date}T10:00:00.000Z`, slotEnd: `${date}T12:00:00.000Z` };
}

export function qaCartDraft(customerId: string, email: string, now: Date = new Date()): CartDraft {
  return {
    currency: 'USD',
    country: 'US',
    customerId,
    inventoryMode: 'None',
    taxMode: 'Platform',
    shippingAddress: address(email),
    shippingMethod: { typeId: 'shipping-method', key: 'standard' },
    lineItems: [
      { sku: QA_SKUS[0], quantity: 2, custom: { type: { typeId: 'type', key: 'line-substitution' }, fields: { substitutionPreference: 'allow-similar' } } },
      { sku: QA_SKUS[1], quantity: 1, custom: { type: { typeId: 'type', key: 'line-substitution' }, fields: { substitutionPreference: 'none' } } },
    ],
    custom: { type: { typeId: 'type', key: 'cart-delivery' }, fields: qaSlot(now) },
  };
}

export function qaOrderDraft(cart: { id: string; version: number }, orderNumber: string): OrderFromCartDraft {
  return { cart: { typeId: 'cart', id: cart.id }, version: cart.version, orderNumber, paymentState: 'Paid', shipmentState: 'Pending' };
}

/** Update actions that move an order from `Open`/`Pending` to the wanted status (the mapping lives in lib/mappers/order.ts). */
export function statusActions(status: QaStatus) {
  switch (status) {
    case 'processing':
      return [];
    case 'packing':
      return [{ action: 'setShipmentState' as const, shipmentState: 'Ready' as const }];
    case 'on-its-way':
      return [{ action: 'setShipmentState' as const, shipmentState: 'Shipped' as const }];
    case 'delivered':
      return [{ action: 'setShipmentState' as const, shipmentState: 'Delivered' as const }, { action: 'changeOrderState' as const, orderState: 'Complete' as const }];
    case 'cancelled':
      return [{ action: 'changeOrderState' as const, orderState: 'Cancelled' as const }];
  }
}

export interface QaOptions {
  status: QaStatus;
  orders: number;
  finalCents?: number;
}

export function parseArgs(argv: string[]): QaOptions {
  const get = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const status = (get('--status') ?? 'processing') as QaStatus;
  if (!QA_STATUSES.includes(status)) throw new Error(`--status must be one of ${QA_STATUSES.join(', ')}`);
  const orders = Number(get('--orders') ?? 1);
  if (!Number.isInteger(orders) || orders < 1 || orders > 25) throw new Error('--orders must be an integer from 1 to 25');
  const finalRaw = get('--final-cents');
  const finalCents = finalRaw === undefined ? undefined : Number(finalRaw);
  if (finalCents !== undefined && (!Number.isInteger(finalCents) || finalCents < 0)) throw new Error('--final-cents must be a non-negative integer');
  return { status, orders, ...(finalCents !== undefined ? { finalCents } : {}) };
}

export async function createQaOrder(root: Root, options: QaOptions): Promise<{ email: string; customerId: string; orders: { id: string; orderNumber: string; cartId: string }[] }> {
  const email = qaEmail();
  const { customer } = (await root.customers().post({ body: qaCustomerDraft(email) }).execute()).body;
  const orders: { id: string; orderNumber: string; cartId: string }[] = [];
  for (let n = 0; n < options.orders; n += 1) {
    const cart = (await root.carts().post({ body: qaCartDraft(customer.id, email) }).execute()).body;
    const orderNumber = `QA-${randomBytes(3).toString('hex').toUpperCase()}`;
    let order = (await root.orders().post({ body: qaOrderDraft(cart, orderNumber) }).execute()).body;
    const actions: Parameters<typeof updateOrder>[2] = [...statusActions(options.status)];
    if (options.finalCents !== undefined) {
      actions.push({
        // D-051: `finalTotal` lives on the `cart-delivery` type, so the order keeps its slot fields.
        action: 'setCustomField',
        name: 'finalTotal',
        value: { type: 'centPrecision', currencyCode: 'USD', centAmount: options.finalCents, fractionDigits: 2 },
      });
    }
    if (actions.length > 0) order = await updateOrder(root, order, actions);
    orders.push({ id: order.id, orderNumber, cartId: cart.id });
  }
  return { email, customerId: customer.id, orders };
}

async function updateOrder(root: Root, order: { id: string; version: number }, actions: Record<string, unknown>[]) {
  return (await root.orders().withId({ ID: order.id }).post({ body: { version: order.version, actions: actions as never } }).execute()).body;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { root } = getAdminRoot();
  const result = await createQaOrder(root, options);
  console.log(`email:      ${result.email}`);
  console.log(`password:   ${QA_PASSWORD}  (fixed throwaway)`);
  console.log(`customerId: ${result.customerId}`);
  for (const o of result.orders) console.log(`order:      ${o.id}  number ${o.orderNumber}  (cart ${o.cartId})  status ${options.status}`);
  console.log('Delete with: npx tsx scripts/seed/cleanup-qa.ts');
}

if (process.argv[1]?.endsWith('create-qa-order.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
