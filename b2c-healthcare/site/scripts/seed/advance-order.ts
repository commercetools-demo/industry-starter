import { STATES } from './data/states';
import { coll, getAdminRoot, isMain, listAll, makeCtx, parseFlags, PREFIX, withRetry, type Ctx } from './lib';

/**
 * QA tool: moves one order to the next `mlv-*` state so the order timeline can be checked without waiting for a pharmacy.
 *
 *   npm run seed:advance -- <orderNumber> <state> [--shipment <ShipmentState>] [--dry-run]     (state: `pharmacist-review` or `mlv-pharmacist-review`)
 *   npm run seed:advance -- <orderNumber> --shipment Partial                                    (only the shipment state)
 *
 * `--shipment` sets the order's `shipmentState` (workstream S, QA of the order page): Pending, Ready, Shipped, Delivered,
 * Partial (shown as "partly shipped"), Backorder or Delayed. It is independent of the State (a `Partial` order is
 * usually `mlv-packed-shipped`) and is applied after the state move, in a separate update.
 *
 * Only transitions defined in data/states.ts are accepted (received -> pharmacist-review -> packed-shipped -> delivered,
 * and cancelled from the first two); anything else is refused before any write. An order with no state may only enter the initial state.
 */
export class TransitionRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionRefusedError';
  }
}

export const normalizeState = (s: string) => (s.startsWith(PREFIX) ? s : `${PREFIX}${s}`);

export const SHIPMENT_STATES = ['Pending', 'Ready', 'Shipped', 'Delivered', 'Partial', 'Backorder', 'Delayed'] as const;
export type ShipmentStateName = (typeof SHIPMENT_STATES)[number];

/** Sets `shipmentState` on one order (`changeShipmentState`). Case-insensitive input; unknown values are refused before any write. */
export async function setShipmentState(ctx: Ctx, orderNumber: string, value: string): Promise<{ orderNumber: string; shipmentState: ShipmentStateName; changed: boolean }> {
  const shipmentState = SHIPMENT_STATES.find((s) => s.toLowerCase() === value.toLowerCase());
  if (!shipmentState) throw new TransitionRefusedError(`Unknown shipment state "${value}". Known: ${SHIPMENT_STATES.join(', ')}`);
  if (!/^[\w-]+$/.test(orderNumber)) throw new TransitionRefusedError('The order number may contain only letters, digits, - and _.');
  const order = (await listAll(ctx.root, 'orders', `orderNumber="${orderNumber}"`))[0];
  if (!order) throw new TransitionRefusedError(`No order with number ${orderNumber}.`);
  if (order.shipmentState === shipmentState) return { orderNumber, shipmentState, changed: false };
  if (!ctx.dryRun) {
    await withRetry(
      () => coll(ctx.root, 'orders').withId({ ID: order.id as string }).post({ body: { version: order.version, actions: [{ action: 'changeShipmentState', shipmentState }] } }).execute(),
      ctx.sleep,
    );
  }
  return { orderNumber, shipmentState, changed: true };
}

export interface AdvanceResult { orderNumber: string; from: string | null; to: string; changed: boolean }

export async function advanceOrder(ctx: Ctx, orderNumber: string, target: string): Promise<AdvanceResult> {
  const to = normalizeState(target);
  const targetDef = STATES.find((s) => s.key === to);
  if (!targetDef) throw new TransitionRefusedError(`Unknown state "${target}". Known: ${STATES.map((s) => s.key).join(', ')}`);
  if (!/^[\w-]+$/.test(orderNumber)) throw new TransitionRefusedError('The order number may contain only letters, digits, - and _.');

  const orders = await listAll(ctx.root, 'orders', `orderNumber="${orderNumber}"`);
  const order = orders[0];
  if (!order) throw new TransitionRefusedError(`No order with number ${orderNumber}.`);

  const stateId = (order.state as { id?: string } | undefined)?.id;
  const states = await listAll(ctx.root, 'states');
  const from = stateId ? ((states.find((s) => s.id === stateId)?.key as string | undefined) ?? null) : null;
  if (stateId && !from) throw new TransitionRefusedError(`Order ${orderNumber} is in a state this tool does not know; refusing.`);

  if (from !== null && !from.startsWith(PREFIX)) throw new TransitionRefusedError(`Order ${orderNumber} is in the state ${from}, which is not an mlv- state.`);
  const allowed = from === null ? STATES.filter((s) => s.initial).map((s) => s.key) : (STATES.find((s) => s.key === from)?.transitions ?? []);
  if (from === to) return { orderNumber, from, to, changed: false };
  if (!allowed.includes(to)) {
    throw new TransitionRefusedError(`${from ?? 'no state'} -> ${to} is not allowed. From ${from ?? 'no state'} you can go to: ${allowed.length ? allowed.join(', ') : 'nothing (final state)'}.`);
  }

  if (!ctx.dryRun) {
    await withRetry(
      () => coll(ctx.root, 'orders').withId({ ID: order.id as string }).post({ body: { version: order.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: to } }] } }).execute(),
      ctx.sleep,
    );
  }
  return { orderNumber, from, to, changed: true };
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv);
  const shipmentAt = argv.indexOf('--shipment');
  const shipment = shipmentAt === -1 ? undefined : argv[shipmentAt + 1];
  if (shipmentAt !== -1 && (!shipment || shipment.startsWith('--'))) throw new Error('--shipment needs a value');
  const [orderNumber, state] = argv.filter((a, i) => !a.startsWith('--') && i !== shipmentAt + 1);
  if (!orderNumber || (!state && !shipment)) throw new Error('Usage: advance-order.ts <orderNumber> [<state>] [--shipment <ShipmentState>] [--dry-run]');
  const { root } = await getAdminRoot();
  const ctx = makeCtx(root, flags);
  if (state) {
    const r = await advanceOrder(ctx, orderNumber, state);
    console.log(r.changed ? `${flags.dryRun ? 'would move' : 'moved'} order ${r.orderNumber}: ${r.from ?? '(no state)'} -> ${r.to}` : `order ${r.orderNumber} is already in ${r.to}`);
  }
  if (shipment) {
    const r = await setShipmentState(ctx, orderNumber, shipment);
    console.log(r.changed ? `${flags.dryRun ? 'would set' : 'set'} shipment state of ${r.orderNumber}: ${r.shipmentState}` : `order ${r.orderNumber} already has shipment state ${r.shipmentState}`);
  }
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
