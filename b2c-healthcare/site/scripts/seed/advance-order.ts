import { STATES } from './data/states';
import { coll, getAdminRoot, isMain, listAll, makeCtx, parseFlags, PREFIX, withRetry, type Ctx } from './lib';

/**
 * QA tool: moves one order to the next `mlv-*` state so the order timeline can be checked without waiting for a pharmacy.
 *
 *   npm run seed:advance -- <orderNumber> <state> [--dry-run]     (state: `pharmacist-review` or `mlv-pharmacist-review`)
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
  const [orderNumber, state] = argv.filter((a) => !a.startsWith('--'));
  if (!orderNumber || !state) throw new Error('Usage: advance-order.ts <orderNumber> <state> [--dry-run]');
  const { root } = await getAdminRoot();
  const r = await advanceOrder(makeCtx(root, flags), orderNumber, state);
  console.log(r.changed ? `${flags.dryRun ? 'would move' : 'moved'} order ${r.orderNumber}: ${r.from ?? '(no state)'} -> ${r.to}` : `order ${r.orderNumber} is already in ${r.to}`);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
