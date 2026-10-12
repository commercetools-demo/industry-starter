// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The cart as it will most likely look after a quantity change or a removal, shown while the request is on its way (workstream N-10).
// An estimate: unit prices, stock and discounts that depend on the quantity are corrected by the server answer that replaces it.
import type { Cart, Money } from '@/lib/types';

const plus = (money: Money, cent: number): Money => ({ ...money, centAmount: money.centAmount + cent });

function withLineDelta(cart: Cart, lineId: string, quantity: number): Cart {
  const line = cart.lines.find((l) => l.id === lineId);
  if (!line) return cart;
  const dq = quantity - line.quantity;
  const lineDelta = line.unitPrice.centAmount * dq;
  const lines = quantity <= 0 ? cart.lines.filter((l) => l.id !== lineId) : cart.lines.map((l) => (l.id === lineId ? { ...l, quantity, total: plus(l.total, lineDelta) } : l));
  const list = (line.listUnitPrice ?? line.unitPrice).centAmount * dq;
  return {
    ...cart,
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    hasSubscription: lines.some((l) => l.recurrence !== null),
    totals: { ...cart.totals, subtotal: plus(cart.totals.subtotal, list), total: plus(cart.totals.total, lineDelta) },
  };
}

/** The cart with the line at `quantity` (at least 1), its total, the item count and the summary adjusted. */
export function applyQuantity(cart: Cart, lineId: string, quantity: number): Cart {
  return withLineDelta(cart, lineId, Math.max(1, quantity));
}

/** The cart without the line. */
export function applyRemoval(cart: Cart, lineId: string): Cart {
  return withLineDelta(cart, lineId, 0);
}
