// npx tsx scripts/demo/advance-order.ts --confirm-project spec-test-b2c-telecom --order MLV-XXXXXXXX <one of the flags below>
// Workstream V, for the Chrome checks: moves ONE order through the states that staff or a carrier would set, so the order page can show
// shipments, parcels, tracking references and the goods/refund states of a return. Admin client, allow-listed project only (D-054).
//   --ship-two-parcels   two deliveries, three parcels (carrier DemoPost, DP000111 / DP000222 / DP000333), shipment state Partial
//   --ship-all           delivers whatever is still missing in one more delivery (DP000444), shipment state Shipped
//   --deliver            shipment state Delivered
//   --seed-received-return --line <lineItemId>   adds a return item that is already `Returned` (the platform sets its payment state to Initial)
//   --refund             payment state Refunded on every return item that is still Initial
import { consoleLog, exitCodeForError, parseArgs, type Log } from '../seed/cli';
import { EXIT } from '../seed/config';
import { getAdminApi, loadSeedEnv, type CtApi } from '../seed/lib';

export const DEMO_CARRIER = 'DemoPost';
export const TRACKING = ['DP000111', 'DP000222', 'DP000333', 'DP000444'] as const;

export type AdvanceMode = 'ship-two-parcels' | 'ship-all' | 'deliver' | 'seed-received-return' | 'refund';
export const MODES: readonly AdvanceMode[] = ['ship-two-parcels', 'ship-all', 'deliver', 'seed-received-return', 'refund'];

interface RawLine {
  id: string;
  quantity: number;
  recurrenceInfo?: unknown;
}
export interface RawOrder {
  id: string;
  version: number;
  lineItems: RawLine[];
  shippingInfo?: { deliveries?: { items?: { id: string; quantity: number }[] }[] };
  returnInfo?: { items: { id: string; paymentState: string }[] }[];
}
export type Action = Record<string, unknown>;

const parcel = (trackingId: string, items?: { id: string; quantity: number }[]): Action => ({
  trackingData: { trackingId, carrier: DEMO_CARRIER },
  ...(items && items.length > 0 ? { items } : {}),
});
const whole = (line: RawLine): { id: string; quantity: number } => ({ id: line.id, quantity: line.quantity });

/** Lines that ship first: those without a monthly charge (equipment, outright devices) before the plans. */
const shippingOrder = (order: RawOrder): RawLine[] => [...order.lineItems].sort((a, b) => Number(a.recurrenceInfo !== undefined) - Number(b.recurrenceInfo !== undefined));

/** The update actions of one flag. Pure: the same order and flag always give the same actions. */
export function planAdvance(order: RawOrder, mode: AdvanceMode, options: { line?: string | undefined; now?: Date } = {}): Action[] {
  switch (mode) {
    case 'ship-two-parcels': {
      const [first, second] = shippingOrder(order);
      if (!first || !second) throw new Error('--ship-two-parcels needs an order with at least two lines');
      return [
        { action: 'addDelivery', items: [whole(first)], parcels: [parcel(TRACKING[0], [whole(first)]), parcel(TRACKING[1])] },
        { action: 'addDelivery', items: [whole(second)], parcels: [parcel(TRACKING[2], [whole(second)])] },
        { action: 'changeShipmentState', shipmentState: 'Partial' },
      ];
    }
    case 'ship-all': {
      const shipped = new Map<string, number>();
      for (const delivery of order.shippingInfo?.deliveries ?? []) for (const item of delivery.items ?? []) shipped.set(item.id, (shipped.get(item.id) ?? 0) + item.quantity);
      const remaining = order.lineItems.flatMap((line) => {
        const left = line.quantity - (shipped.get(line.id) ?? 0);
        return left > 0 ? [{ id: line.id, quantity: left }] : [];
      });
      return [...(remaining.length > 0 ? [{ action: 'addDelivery', items: remaining, parcels: [parcel(TRACKING[3], remaining)] }] : []), { action: 'changeShipmentState', shipmentState: 'Shipped' }];
    }
    case 'deliver':
      return [{ action: 'changeShipmentState', shipmentState: 'Delivered' }];
    case 'seed-received-return': {
      const line = order.lineItems.find((candidate) => candidate.id === options.line);
      if (!options.line || !line) throw new Error('--seed-received-return needs --line <lineItemId> of this order');
      const stamp = (options.now ?? new Date()).toISOString().replace(/\D/g, '').slice(0, 14);
      return [{ action: 'addReturnInfo', returnDate: (options.now ?? new Date()).toISOString(), items: [{ key: `demo-ret-${stamp}`, lineItemId: line.id, quantity: 1, comment: 'demo: received', shipmentState: 'Returned' }] }];
    }
    case 'refund': {
      const pending = (order.returnInfo ?? []).flatMap((info) => info.items).filter((item) => item.paymentState === 'Initial');
      if (pending.length === 0) throw new Error('No return item with refund state Initial on this order');
      return pending.map((item) => ({ action: 'setReturnPaymentState', returnItemId: item.id, paymentState: 'Refunded' }));
    }
  }
}

export async function advanceOrder(api: CtApi, orderNumber: string, mode: AdvanceMode, options: { line?: string | undefined } = {}): Promise<Action[]> {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(orderNumber)) throw new Error('Refusing: not an order number');
  const order = (await api.get(`orders/order-number=${orderNumber}`)) as RawOrder | null;
  if (!order) throw new Error(`No order ${orderNumber}`);
  const actions = planAdvance(order, mode, options);
  await api.post(`orders/${order.id}`, { version: order.version, actions });
  return actions;
}

export async function main(argv: string[], deps: { api?: CtApi; source?: Record<string, string | undefined>; log?: Log } = {}): Promise<number> {
  const log = deps.log ?? consoleLog;
  const args = parseArgs(argv, ['confirm-project', 'order', 'line']);
  try {
    const { api } = await getAdminApi({ mode: 'write', confirmProject: args.values.get('confirm-project'), source: deps.source ?? loadSeedEnv(), api: deps.api });
    const chosen = MODES.filter((mode) => args.flags.has(mode));
    const orderNumber = args.values.get('order');
    if (!orderNumber || chosen.length !== 1) throw new Error(`Usage: --order <orderNumber> and exactly one of ${MODES.map((mode) => `--${mode}`).join(' ')}`);
    const actions = await advanceOrder(api, orderNumber, chosen[0] as AdvanceMode, { line: args.values.get('line') });
    log(`${orderNumber}: ${actions.map((action) => String(action.action) + (action.shipmentState ? ` ${String(action.shipmentState)}` : '')).join(', ')}`);
    return EXIT.OK;
  } catch (err) {
    return exitCodeForError(err, log);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
