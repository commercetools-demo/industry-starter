// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { K } from './data/base';
import { assertRemoteKey, assertSafeProject, fail, isMainModule, loadEnv, readSeedEnv, Runner, type SeedEnv } from './lib';

/**
 * The one dev tool for orders (workstreams K and L). Real life does this in the Merchant Center; here it moves an order along so
 * the confirmation tracker and the account order detail can be seen end to end in a browser.
 *
 *   npm run seed:order -- state   --order-number MC-XXXXXXXXXX --to preparing|ready-for-collection|collected [--dry-run]
 *   npm run seed:order -- ship    --order-number <n> [--partial] [--dry-run]
 *   npm run seed:order -- deliver --order-number <n> [--dry-run]
 *   npm run seed:order -- return  --order-number <n> --set Returned|BackInStock|Unusable|Refunded|NotRefunded [--dry-run]
 *
 * `state` moves the collection state one step at a time (no skipping, no going back) and takes the order numbers of this app
 * (`MC-` plus ten characters). `ship` adds a delivery (a parcel with a synthetic tracking number) for the lines that are to be
 * shipped and sets the shipment state to `Shipped` (all lines shipped) or `Partial` (some); `--partial` ships about half of the
 * first unshipped line, so a second run makes a second delivery. Collect lines are never shipped. `deliver` sets `Delivered`;
 * `return` follows the return state machines. Every subcommand refuses a project key other than EXPECTED_PROJECT_KEY (the same two
 * guards as every seed script) and any transition the state machines do not allow. Nothing is created: only the order you name changes.
 */
export const STATE_CHAIN = [K.orderOrdered, K.orderPreparing, K.orderReady, K.orderCollected] as const;

const SHORT: Record<string, string> = {
  ordered: K.orderOrdered,
  preparing: K.orderPreparing,
  'ready-for-collection': K.orderReady,
  collected: K.orderCollected,
};

/** The project guard of every seed script, re-exported so the test can show that a foreign key is refused. */
export const guardProject = assertSafeProject;

export type Plan = { kind: 'noop' } | { kind: 'move'; to: string } | { kind: 'refuse'; reason: string };

/** The next step for an order currently in `current` (undefined: no state yet) when the operator asks for `to` (a short name). */
export function planTransition(current: string | undefined, to: string): Plan {
  const target = SHORT[to];
  if (!target) return { kind: 'refuse', reason: `unknown state "${to}" (use ${Object.keys(SHORT).join(', ')})` };
  const from = current === undefined ? -1 : STATE_CHAIN.indexOf(current as (typeof STATE_CHAIN)[number]);
  if (current !== undefined && from < 0) return { kind: 'refuse', reason: `the order is in "${current}", which is not part of the collection chain` };
  const next = STATE_CHAIN.indexOf(target as (typeof STATE_CHAIN)[number]);
  if (next === from) return { kind: 'noop' };
  if (next < from) return { kind: 'refuse', reason: 'an order cannot go back to an earlier state' };
  if (next > from + 1) return { kind: 'refuse', reason: `cannot skip a state: next is "${STATE_CHAIN[from + 1]}"` };
  return { kind: 'move', to: target };
}

/** What the tool needs from commercetools (an in-memory stand-in in the tests). */
export interface OrdersPort {
  findByNumber(orderNumber: string): Promise<{ id: string; version: number; stateKey?: string } | undefined>;
  transition(id: string, version: number, stateKey: string): Promise<void>;
}

export async function runState(port: OrdersPort, args: { orderNumber: string; to: string; dryRun: boolean }, log: (line: string) => void = console.log): Promise<number> {
  if (!/^MC-[0-9A-Z]{10}(-[A-H])?$/.test(args.orderNumber)) {
    log(`REFUSED "${args.orderNumber}" is not an order number of this shop`);
    return 1;
  }
  const order = await port.findByNumber(args.orderNumber);
  if (!order) {
    log(`REFUSED no order with number ${args.orderNumber}`);
    return 1;
  }
  const plan = planTransition(order.stateKey, args.to);
  if (plan.kind === 'refuse') {
    log(`REFUSED ${plan.reason}`);
    return 1;
  }
  if (plan.kind === 'noop') {
    log(`${args.orderNumber} is already ${order.stateKey}`);
    return 0;
  }
  if (args.dryRun) {
    log(`dry run: ${args.orderNumber} ${order.stateKey ?? '(no state)'} -> ${plan.to}`);
    return 0;
  }
  await port.transition(order.id, order.version, plan.to);
  log(`${args.orderNumber} is now ${plan.to}`);
  return 0;
}

/** The commercetools side of `OrdersPort`. */
export function sdkOrders(root: ReturnType<ReturnType<typeof createApiBuilderFromCtpClient>['withProjectKey']>): OrdersPort {
  return {
    async findByNumber(orderNumber) {
      try {
        const { body } = await root.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ['state'] } }).execute();
        return { id: body.id, version: body.version, ...(body.state?.obj?.key ? { stateKey: body.state.obj.key } : {}) };
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) return undefined;
        throw e;
      }
    },
    async transition(id, version, stateKey) {
      await root.orders().withId({ ID: id }).post({ body: { version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: stateKey }, force: false }] } }).execute();
    },
  };
}

// Ship, deliver and return (workstream L).

export interface OrderLine { id: string; quantity: number; custom?: { fields?: { fulfilment?: string } }; supplyChannel?: unknown; recurrenceInfo?: unknown }
export interface ShipDelivery { id: string; items: { id: string; quantity: number }[] }
export interface ReturnItemLike { id: string; type: string; shipmentState: string; paymentState: string }
export interface OrderLike {
  id: string;
  version: number;
  orderNumber?: string;
  shippingMode?: string;
  shipmentState?: string;
  lineItems: OrderLine[];
  shippingInfo?: { deliveries?: ShipDelivery[] };
  shipping?: { shippingKey: string; shippingInfo: { deliveries?: ShipDelivery[] } }[];
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
const deliveriesOf = (o: OrderLike): ShipDelivery[] => [
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
  if (!['ship', 'deliver', 'return'].includes(args.command)) throw new OrderOpError('Usage: ship | deliver | return --order-number <n> (see the header of order-ops.ts)');
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

/** One authenticated API root; the second guard (the project reports the key we expect) runs here. */
async function connectRoot(env: SeedEnv) {
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
  assertRemoteKey((await root.get().execute()).body.key, env.projectKey, env.expectedProjectKey);
  return root;
}

type ApiRoot = Awaited<ReturnType<typeof connectRoot>>;

/** The commercetools side of `OrderClient` (ship, deliver, return). */
export function sdkOrderClient(root: ApiRoot): OrderClient {
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
  const argv = process.argv.slice(2);
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  if (!['state', 'ship', 'deliver', 'return'].includes(argv[0] ?? '')) {
    throw new Error('usage: seed:order -- state|ship|deliver|return --order-number <n> [--to <state>] [--partial] [--set <state>] [--dry-run] (see the header of order-ops.ts)');
  }
  const { env } = loadEnv();
  const root = await connectRoot(env);
  if (argv[0] === 'state') {
    const code = await runState(sdkOrders(root), { orderNumber: get('--order-number') ?? '', to: get('--to') ?? '', dryRun: argv.includes('--dry-run') });
    if (code !== 0) process.exit(code);
    return;
  }
  const args = parseOrderArgs(argv);
  await runOrderOp(sdkOrderClient(root), args, new Runner(args.dryRun));
  if (args.dryRun) console.log('dry run: nothing was changed');
}

if (isMainModule(import.meta.url)) main().catch(fail);
