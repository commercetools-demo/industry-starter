// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { assertRemoteKey, assertSafeProject, fail, isMainModule, loadDotenvFiles, readSeedEnv, Runner, type SeedEnv } from './lib';

/**
 * Dev tooling for the storefront's account area (workstream L, task L-14): move an order through shipping, delivery and
 * returns so the order detail can be driven in a browser. These are the L subcommands of the order tool; K's collection
 * state tool (`seed:order state ... --to ready-for-collection`) is a separate script and the two merge into one
 * `order-ops.ts` when K lands (Q-L-16).
 *
 *   npm run seed:order-ship -- ship --order-number <n> [--partial] [--dry-run]
 *   npm run seed:order-ship -- deliver --order-number <n> [--dry-run]
 *   npm run seed:order-ship -- return --order-number <n> --set Returned|BackInStock|Unusable|Refunded|NotRefunded [--dry-run]
 *
 * `ship` adds a delivery (with a parcel and a synthetic tracking number) for the lines that are to be shipped and sets the
 * shipment state to `Shipped` (all lines shipped) or `Partial` (some). `--partial` ships about half of the first unshipped
 * line only, so a second run makes a second delivery. Collect lines are never shipped. Refuses a foreign project key and
 * any transition the state machines do not allow. Nothing is created, only orders you name are changed.
 */

export interface OrderLine { id: string; quantity: number; custom?: { fields?: { fulfilment?: string } }; supplyChannel?: unknown; recurrenceInfo?: unknown }
export interface OrderDelivery { id: string; items: { id: string; quantity: number }[] }
export interface ReturnItemLike { id: string; type: string; shipmentState: string; paymentState: string }
export interface OrderLike {
  id: string;
  version: number;
  orderNumber?: string;
  shippingMode?: string;
  shipmentState?: string;
  lineItems: OrderLine[];
  shippingInfo?: { deliveries?: OrderDelivery[] };
  shipping?: { shippingKey: string; shippingInfo: { deliveries?: OrderDelivery[] } }[];
  returnInfo?: { items: ReturnItemLike[] }[];
}
export type Action = Record<string, unknown>;

export class OrderOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderOpError';
  }
}

const isCollect = (l: OrderLine): boolean => (l.custom?.fields?.fulfilment ?? (l.supplyChannel ? 'collect' : 'delivery')) === 'collect';
const deliveriesOf = (o: OrderLike): OrderDelivery[] => [
  ...(o.shippingInfo?.deliveries ?? []),
  ...(o.shipping ?? []).flatMap((s) => s.shippingInfo.deliveries ?? []),
];

/** Units of each ship line that no delivery covers yet. */
export function unshippedUnits(order: OrderLike): { id: string; quantity: number }[] {
  const shipped = new Map<string, number>();
  for (const d of deliveriesOf(order)) for (const i of d.items) shipped.set(i.id, (shipped.get(i.id) ?? 0) + i.quantity);
  return order.lineItems
    .filter((l) => !isCollect(l))
    .map((l) => ({ id: l.id, quantity: Math.max(0, l.quantity - (shipped.get(l.id) ?? 0)) }))
    .filter((l) => l.quantity > 0);
}

/** `Delivered` is final; `Shipped` has nothing left to ship. */
const SHIPPABLE = new Set([undefined, 'Pending', 'Ready', 'Backorder', 'Partial']);

export function planShip(order: OrderLike, { partial }: { partial: boolean }): Action[] {
  if (!order.lineItems.some((l) => !isCollect(l))) throw new OrderOpError('This order has no lines to ship (collect lines are not shipped).');
  if (!SHIPPABLE.has(order.shipmentState)) throw new OrderOpError(`Cannot ship an order whose shipment state is ${order.shipmentState}.`);
  const left = unshippedUnits(order);
  if (left.length === 0) throw new OrderOpError('Nothing left to ship.');
  const first = left[0] as { id: string; quantity: number };
  const items = partial ? [{ id: first.id, quantity: Math.max(1, Math.ceil(first.quantity / 2)) }] : left;
  const everythingShipped = !partial || (left.length === 1 && items[0]?.quantity === first.quantity);
  const number = order.orderNumber ?? order.id;
  const sequence = deliveriesOf(order).length + 1;
  const shippingKey = order.shippingMode === 'Multiple' ? order.shipping?.[0]?.shippingKey : undefined;
  return [
    {
      action: 'addDelivery',
      ...(shippingKey ? { shippingKey } : {}),
      items,
      parcels: [{ trackingData: { trackingId: `MCF-TRK-${number}-${sequence}`, carrier: 'UPS' } }],
    },
    { action: 'changeShipmentState', shipmentState: everythingShipped ? 'Shipped' : 'Partial' },
  ];
}

export function planDeliver(order: OrderLike): Action[] {
  if (order.shipmentState !== 'Shipped') throw new OrderOpError(`Deliver needs shipment state Shipped (it is ${order.shipmentState ?? 'not set'}).`);
  return [{ action: 'changeShipmentState', shipmentState: 'Delivered' }];
}

export const RETURN_SETS = ['Returned', 'BackInStock', 'Unusable', 'Refunded', 'NotRefunded'] as const;
export type ReturnSet = (typeof RETURN_SETS)[number];

/** The return item state machines: goods Advised, then Returned, then BackInStock or Unusable; money Initial, then Refunded or NotRefunded. */
const SHIPMENT_FROM: Record<string, string[]> = { Returned: ['Advised'], BackInStock: ['Returned'], Unusable: ['Returned'] };
const REFUND_AFTER: Record<string, string[]> = { Refunded: ['Returned', 'BackInStock'], NotRefunded: ['Returned', 'BackInStock', 'Unusable'] };

export function planReturn(order: OrderLike, set: string): Action[] {
  if (!(RETURN_SETS as readonly string[]).includes(set)) throw new OrderOpError(`--set must be one of ${RETURN_SETS.join(', ')}.`);
  const item = (order.returnInfo ?? []).flatMap((r) => r.items).find((i) => i.type === 'LineItemReturnItem');
  if (!item) throw new OrderOpError('This order has no return yet (start one in the account first).');
  if (set in SHIPMENT_FROM) {
    if (!SHIPMENT_FROM[set]!.includes(item.shipmentState)) throw new OrderOpError(`Cannot set ${set} from ${item.shipmentState}.`);
    return [{ action: 'setReturnShipmentState', returnItemId: item.id, shipmentState: set }];
  }
  if (item.paymentState !== 'Initial') throw new OrderOpError(`The refund state is already ${item.paymentState}.`);
  if (!REFUND_AFTER[set]!.includes(item.shipmentState)) throw new OrderOpError(`Cannot set ${set} while the goods are ${item.shipmentState}.`);
  return [{ action: 'setReturnPaymentState', returnItemId: item.id, paymentState: set }];
}

export interface OrderClient {
  getByNumber(orderNumber: string): Promise<OrderLike | undefined>;
  update(order: OrderLike, actions: Action[]): Promise<void>;
}

export interface OrderOpArgs { command: string; orderNumber?: string; partial: boolean; set?: string; dryRun: boolean }

export function parseOrderArgs(argv: string[]): OrderOpArgs {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  return { command: argv[0] ?? '', orderNumber: get('--order-number'), partial: argv.includes('--partial'), set: get('--set'), dryRun: argv.includes('--dry-run') };
}

/** Plans and (unless `--dry-run`) applies one subcommand. Returns the actions it planned. */
export async function runOrderOp(client: OrderClient, args: OrderOpArgs, run: Runner): Promise<Action[]> {
  if (!['ship', 'deliver', 'return'].includes(args.command)) throw new OrderOpError('Usage: ship | deliver | return --order-number <n> (see the header of order-ship.ts)');
  if (!args.orderNumber || !/^[A-Za-z0-9_-]{1,64}$/.test(args.orderNumber)) throw new OrderOpError('--order-number <n> is required.');
  const order = await client.getByNumber(args.orderNumber);
  if (!order) throw new OrderOpError(`No order with number ${args.orderNumber}.`);
  const actions =
    args.command === 'ship' ? planShip(order, { partial: args.partial })
    : args.command === 'deliver' ? planDeliver(order)
    : planReturn(order, args.set ?? '');
  await run.act(`${args.command} order ${args.orderNumber}: ${actions.map((a) => String(a.action)).join(', ')}`, () => client.update(order, actions));
  return actions;
}

/** First guard on the environment: the key must equal the independently typed EXPECTED_PROJECT_KEY and not be another team's. */
export function resolveEnv(raw: Record<string, string | undefined>): SeedEnv {
  const env = readSeedEnv(raw);
  assertSafeProject(env.projectKey, env.expectedProjectKey);
  return env;
}

async function connectOrders(env: SeedEnv): Promise<OrderClient> {
  const client = new ClientBuilder()
    .withProjectKey(env.projectKey)
    .withClientCredentialsFlow({
      host: env.authUrl,
      projectKey: env.projectKey,
      credentials: { clientId: env.clientId, clientSecret: env.clientSecret },
      scopes: env.scopes.split(/[\s,]+/).filter(Boolean),
      httpClient: fetch,
    })
    .withHttpMiddleware({ host: env.apiUrl, httpClient: fetch })
    .build();
  const root = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.projectKey });
  assertRemoteKey((await root.get().execute()).body.key, env.projectKey, env.expectedProjectKey); // second guard
  return {
    async getByNumber(orderNumber) {
      try {
        return (await root.orders().withOrderNumber({ orderNumber }).get().execute()).body as unknown as OrderLike;
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) return undefined;
        throw e;
      }
    },
    async update(order, actions) {
      await root.orders().withId({ ID: order.id }).post({ body: { version: order.version, actions: actions as never } }).execute();
    },
  };
}

async function main() {
  const args = parseOrderArgs(process.argv.slice(2));
  loadDotenvFiles();
  const env = resolveEnv(process.env);
  const client = await connectOrders(env);
  const run = new Runner(args.dryRun);
  await runOrderOp(client, args, run);
  if (args.dryRun) console.log('dry run: nothing was changed');
}

if (isMainModule(import.meta.url)) main().catch(fail);
