import { randomBytes } from 'node:crypto';
import type { CartDraft } from '@commercetools/platform-sdk';
import { getAdminRoot, type Root } from './lib';
import { QA_PASSWORD, qaCartDraft, qaCustomerDraft, qaEmail, qaOrderDraft } from './create-qa-order';

/**
 * Spike W-01 and browser-test data for subscriptions (W): creates a throwaway QA customer, a cart whose milk line carries
 * `recurrenceInfo` (policy key, `Dynamic`), an order from that cart (what the hosted Checkout does at the end), then waits for
 * the Recurring Order that commercetools creates by itself ("Create Order from Cart" method) and prints it.
 *
 *   npx tsx scripts/seed/create-qa-recurring.ts [--policy weekly|every-2-weeks|monthly]
 *
 * Prints only non-secret ids, the QA email and the fixed throwaway password (sign in at /en-US/account/sign-in, then open
 * /en-US/account/subscriptions). Delete everything with `npx tsx scripts/seed/cleanup-qa.ts` (it also cancels and deletes the
 * Recurring Orders; their recurring carts carry the customer id and go with the customer's carts).
 */
export const QA_RECURRING_SKU = 'WHOLE-MILK-1EACH';
export const POLICIES = ['weekly', 'every-2-weeks', 'monthly'] as const;
export type QaPolicy = (typeof POLICIES)[number];

export function parsePolicy(argv: string[]): QaPolicy {
  const i = argv.indexOf('--policy');
  const value = i >= 0 ? argv[i + 1] : 'every-2-weeks';
  if (!POLICIES.includes(value as QaPolicy)) throw new Error(`--policy must be one of ${POLICIES.join(', ')}`);
  return value as QaPolicy;
}

/** The QA cart of create-qa-order with the milk line made recurring (Dynamic, as the storefront does; D-034). */
export function qaRecurringCartDraft(customerId: string, email: string, policy: QaPolicy, now: Date = new Date()): CartDraft {
  const base = qaCartDraft(customerId, email, now);
  return {
    ...base,
    lineItems: (base.lineItems ?? []).map((l) =>
      l.sku === QA_RECURRING_SKU
        ? { ...l, recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy' as const, key: policy }, priceSelectionMode: 'Dynamic' as const } }
        : l,
    ),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The Recurring Orders whose origin is the order (they may appear a few seconds after the order). */
export async function waitForRecurringOrders(root: Root, orderId: string, attempts = 10, delayMs = 2000) {
  for (let n = 0; n < attempts; n += 1) {
    const res = await root.recurringOrders().get({ queryArgs: { where: `originOrder(id="${orderId}")`, limit: 20 } }).execute();
    if (res.body.results.length > 0) return res.body.results;
    await sleep(delayMs);
  }
  return [];
}

export async function createQaRecurring(root: Root, policy: QaPolicy) {
  const email = qaEmail();
  const { customer } = (await root.customers().post({ body: qaCustomerDraft(email) }).execute()).body;
  const cart = (await root.carts().post({ body: qaRecurringCartDraft(customer.id, email, policy) }).execute()).body;
  const orderNumber = `QA-${randomBytes(3).toString('hex').toUpperCase()}`;
  const order = (await root.orders().post({ body: qaOrderDraft(cart, orderNumber) }).execute()).body;
  const recurringOrders = await waitForRecurringOrders(root, order.id);
  return { email, customerId: customer.id, order, recurringOrders };
}

async function main() {
  const policy = parsePolicy(process.argv.slice(2));
  const { root } = getAdminRoot();
  const r = await createQaRecurring(root, policy);
  console.log(`email:      ${r.email}`);
  console.log(`password:   ${QA_PASSWORD}  (fixed throwaway)`);
  console.log(`customerId: ${r.customerId}`);
  console.log(`order:      ${r.order.id}  number ${r.order.orderNumber}`);
  if (r.recurringOrders.length === 0) console.log('RESULT: NO Recurring Order was created from the order (spike W-01 failed).');
  for (const ro of r.recurringOrders) {
    console.log(`recurring:  ${ro.id}  state ${ro.recurringOrderState}  schedule ${JSON.stringify(ro.schedule)}  nextOrderAt ${ro.nextOrderAt ?? '-'}  cart ${ro.cart.id}`);
  }
  console.log('Delete with: npx tsx scripts/seed/cleanup-qa.ts');
}

if (process.argv[1]?.endsWith('create-qa-recurring.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
