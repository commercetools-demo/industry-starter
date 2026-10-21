import type { OrderState, OrderStatusKind } from '@/lib/types';

export interface StatusInput {
  /** commercetools `orderState`. */
  orderState: string;
  /** Key of the order's `mcf-order-*` state without the prefix, or null when the order has no state yet. */
  stateKey: OrderState | null;
  shipmentState: string | null;
  hasCollect: boolean;
  hasShip: boolean;
}

/** Plan section 3.5. Pure. The two machines (collect state, shipment state) are combined here and never shown as one chip. */
export function deriveOrderStatus(o: StatusInput): OrderStatusKind {
  if (o.orderState === 'Cancelled') return 'cancelled';
  if (!o.hasCollect && !o.hasShip) return 'ordered';
  const collectDone = !o.hasCollect || o.stateKey === 'collected';
  const shipDone = !o.hasShip || o.shipmentState === 'Delivered';
  if (collectDone && shipDone) return 'completed';
  if (o.hasCollect && o.stateKey === 'ready-for-collection') return 'ready';
  if (o.hasShip && (o.shipmentState === 'Shipped' || o.shipmentState === 'Partial')) return 'shipped';
  if (o.hasCollect && o.stateKey === 'preparing') return 'preparing';
  return 'ordered';
}

/** Label key under `account.orders.pill.` (collect only reads "Collected", ship only "Delivered", mixed "Completed"). */
export function pillKey(status: OrderStatusKind, hasCollect: boolean, hasShip: boolean): string {
  if (status !== 'completed') return status;
  if (hasCollect && !hasShip) return 'collected';
  if (hasShip && !hasCollect) return 'delivered';
  return 'completed';
}

export interface ReturnableInput {
  status: OrderStatusKind;
  /** ISO time the order was completed (approximation: `lastModifiedAt`, Q-L-15). */
  completedAt: string;
  /** Units still returnable per line. */
  returnable: Record<string, number>;
}

export function returnWindowEnds(completedAt: string, windowDays: number): Date {
  return new Date(new Date(completedAt).getTime() + windowDays * 86400000);
}

/** Completed, at least one unit left to return, and still inside the window. */
export function canReturn(o: ReturnableInput, now: Date, windowDays: number): boolean {
  if (o.status !== 'completed') return false;
  if (!Object.values(o.returnable).some((q) => q > 0)) return false;
  return now.getTime() <= returnWindowEnds(o.completedAt, windowDays).getTime();
}

export const isOpenStatus = (s: OrderStatusKind): boolean => s !== 'completed' && s !== 'cancelled';
