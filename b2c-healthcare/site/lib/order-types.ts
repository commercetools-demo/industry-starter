// Shapes of the order pages (workstream S). Types and pure constants only: safe in client components.
import type { Money } from '@/lib/types';

/** Order State keys of the seed without the `mlv-` prefix. */
export type OrderStatus = 'received' | 'pharmacist-review' | 'packed-shipped' | 'delivered' | 'cancelled';

/** Timeline order. `cancelled` is not a step: it ends the order wherever it was. */
export const ORDER_STEPS = ['received', 'pharmacist-review', 'packed-shipped', 'delivered'] as const;

/** commercetools `ShipmentState`; null when never set. */
export type ShipmentState = 'Pending' | 'Ready' | 'Shipped' | 'Delivered' | 'Partial' | 'Backorder' | 'Delayed';

/** Refund as the buyer sees it, from the Payment's `Refund` transactions. Only cancelled orders can have one. */
export type RefundStatus = 'none' | 'requested' | 'refunded';

/** The instruments an order line can be settled with (workstream U). */
export type Instrument = 'allowance' | 'restricted-health-account' | 'card';

export interface OrderLineView {
  /** Catalog SKU as ordered, so the name can link to the medicine page (AB). */
  sku?: string;
  name: string;
  quantity: number;
  /** Treated as qualifying for the restricted instrument when the order was placed (copied then, not live). Absent on orders from before it was recorded. */
  eligible?: boolean;
  /** The instruments that settled this line, as recorded at placement. */
  settledBy?: Instrument[];
}

/** How an order was paid, when more than the card was used (workstream U). */
export interface OrderTender {
  allowance: Money;
  restricted: Money;
  /** What the card was charged: the total less the other two. */
  card: Money;
}

export interface OrderView {
  id: string;
  /** `MLV-000042`. */
  orderNumber: string;
  status: OrderStatus;
  shipmentState: ShipmentState | null;
  /** ISO instant. */
  createdAt: string;
  lines: OrderLineView[];
  /** One-line address, or null when the order has none. */
  deliverTo: string | null;
  sameDay: boolean;
  total: Money;
  refund: RefundStatus;
  /** Cancellation is offered until the order is packed and shipped. */
  cancellable: boolean;
  /** Present when the allowance or the restricted instrument paid part of the order. */
  tender?: OrderTender;
}

export type NotAddedReason = 'NO_REFILLS' | 'EXPIRED' | 'OUT_OF_STOCK' | 'UNAVAILABLE';

export interface ReorderResult {
  /** Names of the medications put in the cart. */
  added: string[];
  /** Medications that could not be added, with the reason. */
  notAdded: { name: string; reason: NotAddedReason }[];
}

/** States from which an order may still be cancelled (until `mlv-packed-shipped`, Q-043). */
export const CANCELLABLE: readonly OrderStatus[] = ['received', 'pharmacist-review'];
