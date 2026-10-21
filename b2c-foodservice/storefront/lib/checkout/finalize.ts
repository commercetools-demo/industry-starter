import 'server-only';
import { postOrderHooks } from '@/lib/checkout/post-order';
import { ensureOrderState, getOrderById, getOrderByNumber } from '@/lib/ct/orders';
import { mapOrder } from '@/lib/mappers/order';
import type { OrderView } from '@/lib/types';

/**
 * Finalises a placed order (workstream K): finds it (by id or by order number), makes sure it has the `mcf-order-ordered` state,
 * and runs the post-order hooks. Idempotent: running it again changes nothing (the state is only set when missing, and the hooks
 * are the registered ones' own business). Returns null when the order does not exist (yet).
 */
export async function finalizeOrder(
  ref: { orderId: string } | { orderNumber: string },
  now: Date = new Date(),
  hooks: ReadonlyArray<(order: OrderView) => Promise<void>> = postOrderHooks,
): Promise<OrderView | null> {
  const found = 'orderId' in ref ? await getOrderById(ref.orderId) : await getOrderByNumber(ref.orderNumber);
  if (!found) return null;
  const order = await ensureOrderState(found);
  const view = mapOrder(order, { locale: order.locale ?? '', now });
  for (const hook of hooks) {
    try {
      await hook(view);
    } catch {
      console.warn(JSON.stringify({ event: 'post_order_hook_failed', orderId: view.id }));
    }
  }
  return view;
}

export interface PollOptions {
  attempts: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Order creation by the hosted Checkout can trail the browser event by a moment: poll up to `attempts` times, `delayMs` apart. */
export async function finalizeWithPolling(
  ref: { orderId: string } | { orderNumber: string },
  options: PollOptions = { attempts: 5, delayMs: 1000 },
): Promise<OrderView | null> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let i = 0; i < options.attempts; i += 1) {
    const view = await finalizeOrder(ref);
    if (view) return view;
    if (i < options.attempts - 1) await sleep(options.delayMs);
  }
  return null;
}
